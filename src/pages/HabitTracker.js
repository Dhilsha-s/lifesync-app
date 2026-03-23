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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = getDaysInMonth(year, month);
  const todayDbString = formatLocalYYYYMMDD(new Date());

  useEffect(() => {
    if (isMobile && todayRowRef.current && !loading) {
      setTimeout(() => {
        todayRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, [isMobile, loading, currentDate]);

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
        <div className="flex h-[50vh] items-center justify-center">
          <div className="w-8 h-8 border-2 border-border border-t-lime rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="habits" onNavigate={onNavigate}>
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-8 bg-bg min-h-[calc(100vh-80px)] text-text-primary animate-in fade-in duration-700">
        
        <header className="mb-8">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl text-white">Daily Tracker</h1>
        </header>
        
        {isMobile ? (
          <div className="flex flex-col gap-4 pb-24">
            {days.map((day) => {
              const isToday = day.dbDate === todayDbString;
              const isPast = day.dbDate < todayDbString;
              const isFuture = day.dbDate > todayDbString;
              
              let doneCount = 0;
              let totalCount = columns.length;
              if (columns && columns.length > 0) {
                columns.forEach(habitName => {
                  if (records[`${day.dbDate}-${habitName}`]) doneCount++;
                });
              }

              const pillColor = doneCount > 0 ? 'text-lime' : 'text-gray-500';
              const cardOpacity = (isPast && doneCount === 0) ? 'opacity-50' : 'opacity-100';

              const cardClasses = isToday 
                ? 'bg-[#141f0a] border border-[#2a3a10] rounded-[14px] p-4' 
                : `bg-[#141414] border border-[#1f1f1f] rounded-[14px] p-4 ${cardOpacity}`;

              const colors = ['#C8F135', '#FF3CAC', '#FFE500', '#3CC8FF', '#FF6B35', '#A855F7'];

              return (
                <div key={day.dbDate} className={cardClasses} ref={isToday ? todayRowRef : null}>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white tracking-wide">{day.display}</span>
                      {isToday && (
                         <div className="flex items-center gap-1.5 ml-2">
                            <span className="w-2 h-2 rounded-full bg-lime animate-pulse"></span>
                            <span className="text-[10px] font-bold text-lime tracking-widest uppercase">Today</span>
                         </div>
                      )}
                    </div>
                    <div className={`text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/5 ${pillColor}`}>
                      {doneCount}/{totalCount} done
                    </div>
                  </div>
                  
                  <div className="flex overflow-x-auto gap-2 pb-2 snap-x" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                    <style>{`
                      .flex::-webkit-scrollbar { display: none; }
                    `}</style>
                    {columns && columns.map((habitName, idx) => {
                      const key = `${day.dbDate}-${habitName}`;
                      const isChecked = records[key];
                      const color = colors[idx % colors.length];

                      if (isPast || isFuture) {
                         return (
                           <div key={key} className="snap-start shrink-0 h-[36px] flex items-center px-4 rounded-full bg-[#1a1a1a] text-[#444] text-xs font-semibold whitespace-nowrap">
                             {habitName}
                           </div>
                         );
                      }

                      if (isChecked) {
                        return (
                          <button 
                            key={key} 
                            onClick={() => toggleCheck(day.dbDate, habitName)}
                            className="snap-start shrink-0 h-[36px] flex items-center gap-1.5 px-4 rounded-full text-black text-xs font-bold whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-transform active:scale-95"
                            style={{ backgroundColor: color }}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            {habitName}
                          </button>
                        );
                      } else {
                        return (
                          <button 
                            key={key} 
                            onClick={() => toggleCheck(day.dbDate, habitName)}
                            className="snap-start shrink-0 h-[36px] flex items-center px-4 rounded-full bg-transparent text-[#666] text-xs font-semibold whitespace-nowrap border-[1.5px] border-[#2a2a2a] transition-all active:scale-95"
                          >
                            {habitName}
                          </button>
                        );
                      }
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-border rounded-[16px] overflow-hidden bg-card shadow-xl overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="sticky left-0 bg-surface p-4 border-r border-border z-10 text-text-muted font-bold uppercase tracking-wider text-xs">Date</th>
                {columns && columns.length > 0 ? (
                  columns.map((habitName) => (
                    <th
                      key={habitName}
                      className="px-5 py-4 text-center min-w-[140px] text-text-muted font-bold uppercase tracking-wider text-xs"
                    >
                      {habitName}
                    </th>
                  ))
                ) : (
                  <th className="px-5 py-4 text-center text-text-muted">No habits yet</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {days.map((day) => {
                const isToday = day.dbDate === todayDbString;
                const isPast = day.dbDate < todayDbString;
                const isFuture = day.dbDate > todayDbString;
                const dateIcon = isToday ? ' ✏️' : isPast ? ' 🔒' : ' ⏳';

                return (
                  <tr key={day.dbDate} className={`transition-colors ${isToday ? 'bg-[#141f0a] text-lime' : 'hover:bg-white/[0.02]'}`}>
                    <td className={`sticky left-0 p-4 border-r border-border z-10 font-medium ${isToday ? 'bg-[#141f0a] text-lime' : 'bg-card'}`}>
                      <span className={isPast ? 'opacity-50' : isFuture ? 'opacity-30' : ''}>
                        {day.display}{dateIcon}
                      </span>
                    </td>
                    {columns && columns.length > 0 ? (
                      columns.map((habitName) => {
                        const key = `${day.dbDate}-${habitName}`;
                        const isChecked = records[key];
                        const tooltip = isToday ? 'Click to mark done' : isPast ? 'Cannot edit past dates' : 'Not yet!';

                        return (
                          <td
                            key={key}
                            className="px-5 py-3 text-center border-l border-border/20"
                          >
                            <button
                              onClick={isToday ? () => toggleCheck(day.dbDate, habitName) : undefined}
                              disabled={!isToday}
                              title={tooltip}
                              className={`w-[30px] h-[30px] inline-flex items-center justify-center rounded-[8px] border-2 transition-all ${
                                isChecked
                                  ? isToday
                                    ? 'bg-lime border-lime text-bg cursor-pointer'
                                    : 'bg-lime/40 border-lime/40 text-bg/50 cursor-not-allowed'
                                  : isToday
                                    ? 'bg-transparent border-border hover:border-lime cursor-pointer'
                                    : 'bg-transparent border-border/50 cursor-not-allowed'
                              }`}
                              style={{ opacity: isPast ? 0.3 : isFuture ? 0.2 : 1 }}
                            >
                              {isChecked && (
                                <svg
                                  className="w-5 h-5"
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
                        );
                      })
                    ) : (
                      <td className="px-5 py-3 text-center text-text-dim">—</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}

        <button 
          onClick={() => setIsChatOpen(true)} 
          className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-lime text-bg rounded-full flex items-center justify-center text-2xl hover:scale-110 transition-transform z-40 shadow-[0_4px_20px_rgba(200,241,53,0.3)]"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>

        <div className={`fixed inset-y-0 right-0 z-[60] w-full max-w-[380px] bg-surface border-l border-border shadow-2xl transition-transform duration-500 flex flex-col ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <header className="p-5 border-b border-border bg-card flex justify-between items-center">
            <h2 className="font-bold text-white tracking-tight">Habit AI</h2>
            <button onClick={() => setIsChatOpen(false)} className="text-text-muted hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>
          
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatMessages.map((m, i) => (
              <div
                key={i}
                className={`p-4 rounded-[14px] max-w-[85%] text-sm font-medium leading-relaxed ${
                  m.role === 'ai'
                    ? 'bg-card border border-border self-start text-white'
                    : 'bg-lime text-bg self-end ml-auto'
                }`}
              >
                {m.text}
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-1 p-4 w-16 bg-card border border-border rounded-[14px]">
                <div className="w-2 h-2 bg-text-dim rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-text-dim rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-text-dim rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            )}
          </div>
          
          <form onSubmit={handleChatSend} className="p-4 border-t border-border bg-card">
            <div className="relative">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                maxLength={CHAT_INPUT_MAX}
                disabled={chatLoading}
                className="w-full bg-surface border border-border text-white rounded-full pl-5 pr-12 py-3 outline-none focus:border-lime transition-colors disabled:opacity-50 placeholder:text-text-muted text-sm font-medium"
                placeholder="Ask AI to update habits..."
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim() || chatLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-lime text-bg rounded-full disabled:opacity-50 disabled:bg-surface disabled:text-text-muted transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </form>
        </div>
        {isChatOpen && <div className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsChatOpen(false)} />}
      </div>
    </AppShell>
  );
}