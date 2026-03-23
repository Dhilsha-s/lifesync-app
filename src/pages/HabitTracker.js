import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import AppShell from '../components/AppShell';
import { createRateLimiter } from '../lib/rateLimiter';
import { CHAT_INPUT_MAX } from '../lib/validation';

const chatLimiter = createRateLimiter(10, 60_000);

function formatLocalYYYYMMDD(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

function getDaysInMonth(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    d.setHours(0, 0, 0, 0);
    const dbDate = formatLocalYYYYMMDD(d);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNumber = d.getDate();
    return { dbDate, display: `${dayNumber} ${dayName}`, date: d };
  });
}

// Safely extract a habit name string from any value (string, object, etc.)
function toHabitName(h) {
  if (typeof h === 'string') return h.trim();
  if (h && typeof h === 'object') return String(h.habit_name || h.name || h.title || '').trim();
  return String(h || '').trim();
}

function getFallbackHabits(goal) {
  const g = (goal || '').toLowerCase();
  if (g.includes('weight') || g.includes('lose') || g.includes('fat') || g.includes('kg')) return ["Workout 30 min", "Track calories", "Drink 3L water", "Walk 8000 steps", "Sleep 8 hours", "No junk food"];
  if (g.includes('study') || g.includes('exam') || g.includes('learn') || g.includes('college')) return ["Study 2 hours", "Solve problems", "Revise notes", "No social media", "Sleep by 11pm", "Read 30 min"];
  if (g.includes('business') || g.includes('startup') || g.includes('money')) return ["Work on MVP", "Network 30 min", "Learn new skill", "Read business book", "Track expenses", "Exercise"];
  return ["Morning routine", "Deep work 2hr", "Exercise", "Read 30 min", "Reflect/journal", "Sleep 8 hours"];
}

export default function HabitTracker({ onNavigate, goalTitle = '', userId, initialGeneratedHabits = null, groqKey, deadline }) {
  const [columns, setColumns] = useState([]);
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [toastError, setToastError] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'ai', text: "Hi! Need to tweak your habits?", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef(null);
  const todayRowRef = useRef(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = getDaysInMonth(year, month);
  const todayDbString = formatLocalYYYYMMDD(new Date());

  // LOAD DATA: Fetch habits from Supabase, restore checked state, initialize fallback if needed
  useEffect(() => {
    async function loadData() {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);

        // 1. Fetch all habits from Supabase for this user
        const { data: existingData, error: fetchError } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', userId);

        if (fetchError) {
          console.error("HabitTracker: Failed to fetch habits", fetchError);
        }

        // 2. Build records map and extract unique habit names
        const recordsMap = {};
        const uniqueNames = new Set();

        if (existingData && existingData.length > 0) {
          existingData.forEach(row => {
            uniqueNames.add(row.habit_name);
            recordsMap[`${row.date}-${row.habit_name}`] = row.completed;
          });
        }

        // 3. Determine active habit names
        let activeHabitNames = Array.from(uniqueNames);

        // If no habits in database, use generated or fallback
        if (activeHabitNames.length === 0) {
          const source = initialGeneratedHabits || getFallbackHabits(goalTitle);
          activeHabitNames = source.map(toHabitName).filter(Boolean);

          // Save fallback habits to Supabase so they persist
          if (activeHabitNames.length > 0) {
            const habitRows = activeHabitNames.map(habitName => ({
              user_id: userId,
              date: todayDbString,
              habit_name: habitName,
              completed: false,
            }));
            const { error: insertError } = await supabase
              .from('habits')
              .insert(habitRows)
              .select();
            if (insertError) {
              console.error("HabitTracker: Failed to insert fallback habits", insertError);
            }
          }
        }

        setColumns(activeHabitNames);
        setRecords(recordsMap);
      } catch (err) {
        console.error("HabitTracker: Failed to load data", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [userId, initialGeneratedHabits, goalTitle]);

  // AUTO-SCROLL CHAT TO BOTTOM
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const toggleCheck = async (dbDate, habitName) => {
    if (!userId) return;

    // Use date-habitname as unique key
    const key = `${dbDate}-${habitName}`;
    const newValue = !records[key];

    // Update local state immediately for UI responsiveness
    setRecords(prev => ({ ...prev, [key]: newValue }));

    // Persist to Supabase
    const { error } = await supabase
      .from('habits')
      .upsert(
        {
          user_id: userId,
          date: dbDate,
          habit_name: habitName,
          completed: newValue,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,date,habit_name' }
      );

    if (error) {
      console.error("HabitTracker: Failed to toggle habit", error);
      // Revert local state on error
      setRecords(prev => ({ ...prev, [key]: !newValue }));
    }
  };

  const handleChatSend = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const text = chatInput.trim().slice(0, CHAT_INPUT_MAX);

    const { allowed, retryAfterMs } = chatLimiter.checkLimit();
    if (!allowed) {
      const secs = Math.ceil(retryAfterMs / 1000);
      setChatMessages(prev => [...prev, { role: 'ai', text: `Too many messages! Wait ${secs}s.`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      return;
    }

    // Add user message
    setChatMessages(prev => [...prev, { role: 'user', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const systemPrompt = `You are a habit optimization AI. Current habits: ${JSON.stringify(columns)}.
      
If the user wants to update habits, output:
UPDATE_HABITS
["Habit 1", "Habit 2", "Habit 3"]

Example: If user says "Add meditation", output:
UPDATE_HABITS
["Morning routine", "Deep work 2hr", "Exercise", "Read 30 min", "Meditation", "Reflect/journal", "Sleep 8 hours"]

Always output valid JSON array of strings. Otherwise, just provide helpful advice.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey || process.env.REACT_APP_GROQ_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || 'No response';

      // Check if AI wants to update habits
      if (aiResponse.includes('UPDATE_HABITS')) {
        try {
          // Extract JSON from response
          const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            const newHabitsRaw = JSON.parse(jsonMatch[0]);
            const newHabits = Array.isArray(newHabitsRaw)
              ? newHabitsRaw.map(toHabitName).filter(Boolean)
              : [];

            if (newHabits.length > 0) {
              // Update local state
              setColumns(newHabits);

              // Save new habits to Supabase
              if (userId) {
                const habitRows = newHabits.map(habitName => ({
                  user_id: userId,
                  date: todayDbString,
                  habit_name: habitName,
                  completed: false,
                }));

                // Delete old habits for this user
                await supabase
                  .from('habits')
                  .delete()
                  .eq('user_id', userId)
                  .eq('date', todayDbString);

                // Insert new habits
                const { error } = await supabase
                  .from('habits')
                  .insert(habitRows);

                if (error) {
                  console.error("HabitTracker: Failed to save new habits", error);
                }
              }

              setChatMessages(prev => [...prev, { role: 'ai', text: "Done! I've updated your habit list.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
            } else {
              setChatMessages(prev => [...prev, { role: 'ai', text: aiResponse, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
            }
          } else {
            setChatMessages(prev => [...prev, { role: 'ai', text: aiResponse, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
          }
        } catch (parseErr) {
          console.error("HabitTracker: Failed to parse habit JSON", parseErr);
          setChatMessages(prev => [...prev, { role: 'ai', text: "I wanted to update your habits, but there was an issue. Please try again.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        }
      } else {
        // Just a regular response
        setChatMessages(prev => [...prev, { role: 'ai', text: aiResponse, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      }
    } catch (err) {
      console.error("HabitTracker: Chat request failed", err);
      setChatMessages(prev => [...prev, { role: 'ai', text: "Sorry, something went wrong. Please try again.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell activeTab="habits" onNavigate={onNavigate}>
        <div className="flex h-[50vh] items-center justify-center"><div className="w-8 h-8 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" /></div>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="habits" onNavigate={onNavigate}>
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-8 bg-[#111111] min-h-[calc(100vh-80px)] text-white">
        <header className="mb-8"><h1 className="text-3xl font-medium tracking-tight sm:text-4xl text-[#f3f4f6]">Daily Tracker</h1></header>
        <div className="border border-white/10 rounded-lg overflow-hidden bg-[#161616] shadow-xl overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
            <thead>
              <tr className="bg-[#1c1c1c] border-b border-white/10">
                <th className="sticky left-0 bg-[#1c1c1c] p-4 border-r border-white/10 z-10">Date</th>
                {columns && columns.length > 0 ? (
                  columns.map((habitName) => (
                    <th
                      key={habitName}
                      className="px-5 py-4 text-center min-w-[140px] font-medium"
                    >
                      {habitName}
                    </th>
                  ))
                ) : (
                  <th className="px-5 py-4 text-center text-gray-400">No habits yet</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {days.map((day) => (
                <tr key={day.dbDate} className={`hover:bg-white/[0.03] ${day.dbDate === todayDbString ? 'bg-[#13231c]' : ''}`}>
                  <td className={`sticky left-0 p-4 border-r border-white/10 z-10 ${day.dbDate === todayDbString ? 'bg-[#152a22]' : 'bg-[#161616]'}`}>{day.display}</td>
                  {columns && columns.length > 0 ? (
                    columns.map((habitName) => (
                      <td
                        key={`${day.dbDate}-${habitName}`}
                        className="px-5 py-3 text-center"
                      >
                        <button
                          onClick={() => toggleCheck(day.dbDate, habitName)}
                          className={`w-6 h-6 rounded border transition-all ${records[`${day.dbDate}-${habitName}`]
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'bg-[#161616] border-[#444] hover:border-[#888]'
                            }`}
                        >
                          {records[`${day.dbDate}-${habitName}`] && (
                            <svg
                              className="w-4 h-4 mx-auto"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </td>
                    ))
                  ) : (
                    <td className="px-5 py-3 text-center text-gray-400">—</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={() => setIsChatOpen(true)} className="fixed bottom-10 right-10 w-14 h-14 bg-emerald-600 rounded-full shadow-2xl flex items-center justify-center text-2xl hover:bg-emerald-500 transition-all z-40">💬</button>

        <div className={`fixed inset-y-0 right-0 z-[60] w-full max-w-[380px] bg-[#111111] border-l border-white/10 shadow-2xl transition-transform duration-500 flex flex-col ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <header className="p-5 border-b border-white/5 bg-[#161616] flex justify-between items-center"><h2 className="font-semibold">Habit AI</h2><button onClick={() => setIsChatOpen(false)}>✕</button></header>
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatMessages.map((m, i) => (
              <div
                key={i}
                className={`p-3 rounded-2xl max-w-[85%] ${m.role === 'ai'
                  ? 'bg-[#1c1c1c] self-start'
                  : 'bg-emerald-600 self-end ml-auto'
                  }`}
              >
                {m.text}
              </div>
            ))}
          </div>
          <form onSubmit={handleChatSend} className="p-4 border-t border-white/5">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              maxLength={CHAT_INPUT_MAX}
              disabled={chatLoading}
              className="w-full bg-[#222] border-none rounded-full px-5 py-2 outline-none disabled:opacity-50"
              placeholder="Message AI..."
            />
          </form>
        </div>
        {isChatOpen && <div className="fixed inset-0 z-[55] bg-black/60" onClick={() => setIsChatOpen(false)} />}
      </div>
    </AppShell>
  );
}