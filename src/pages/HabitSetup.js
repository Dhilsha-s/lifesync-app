import { useEffect, useRef, useState } from 'react';
import { createRateLimiter } from '../lib/rateLimiter';
import { CHAT_INPUT_MAX } from '../lib/validation';

const chatLimiter = createRateLimiter(10, 60_000);

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getFallbackHabits(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('weight') || t.includes('lose') || t.includes('fitness') || t.includes('health') || t.includes('workout') || t.includes('gym')) {
    return ["Workout 30 min", "Track calories", "Drink 3L water", "Walk 8000 steps", "Sleep 8 hours"];
  }
  if (t.includes('study') || t.includes('exam') || t.includes('learn') || t.includes('read') || t.includes('school') || t.includes('college')) {
    return ["Study 2 hours", "Solve problems", "Revise notes", "No social media", "Sleep by 11pm"];
  }
  return ["Morning routine", "Deep work 2hr", "Exercise", "Read 30 min", "Reflect/journal"];
}

export default function HabitSetup({ onComplete, goalTitle = '' }) {
  const [messages, setMessages] = useState([
    { 
      role: 'ai', 
      text: goalTitle 
        ? `Hi there! I'm here to help you design a habit tracker that actually fits into your daily life.\n\nI see your main focus is "${goalTitle}". Tell me a bit more about what makes this important to you, and what your typical day looks like so far!` 
        : `Hi there! I'm here to help you design a habit tracker that actually fits into your daily life.\n\nFirst, what is your main goal? And what does your typical day look like right now?`,
      time: formatTime(new Date())
    }
  ]);
  const [inputTimer, setInputTimer] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = inputTimer.trim().slice(0, CHAT_INPUT_MAX);
    if (!text || loading) return;

    // Rate limiting
    const { allowed, retryAfterMs } = chatLimiter.checkLimit();
    if (!allowed) {
      const secs = Math.ceil(retryAfterMs / 1000);
      setMessages(prev => [...prev, { role: 'ai', text: `You're going a bit fast! Please wait ${secs}s.`, time: formatTime(new Date()) }]);
      return;
    }

    const userMessage = { role: 'user', text, time: formatTime(new Date()) };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputTimer('');
    setLoading(true);

    try {
      // Build history for Groq
      const history = newMessages.map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text
      }));

      const systemPrompt = `You are a friendly, warm habit coach helping a human build a personalized daily habit tracker.
Keep your responses short, conversational, and natural (like a WhatsApp or iMessage text). Do NOT use robotic or overly enthusiastic language.
Your goal is to understand their lifestyle, available time, and challenges.
Ask ONE follow-up question per response.
After 3 to 4 exchanges total, you must decide you have enough context.
When you have enough context, you MUST end your message by saying EXACTLY "HABITS_READY" followed by a JSON array of 5 to 6 specific, actionable daily habits.
Example format for ending:
"That makes total sense! I have everything I need to build your tracker.
HABITS_READY
["Wake up at 7am", "Read 10 pages", "Drink 1L water before noon", "Review anki cards"]"`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.REACT_APP_GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            ...history
          ]
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed API. Status: ${response.status}`);
      }

      const payload = await response.json();
      const aiResponse = payload.choices[0].message.content;

      // Check for completion magic string
      if (aiResponse.includes('HABITS_READY')) {
        const parts = aiResponse.split('HABITS_READY');
        const textPart = parts[0].trim();
        const jsonPart = parts[1].trim();
        
        // Show the text part if it exists before navigating away
        if (textPart) {
          setMessages(prev => [...prev, { role: 'ai', text: textPart, time: formatTime(new Date()) }]);
        }

        // Parse JSON
        let habits = [];
        try {
          // Robustly find anything resembling an array bracket block
          const match = jsonPart.match(/\[[\s\S]*?\]/);
          if (match) {
            habits = JSON.parse(match[0]);
          } else {
            habits = JSON.parse(jsonPart);
          }
          // Ensure it's an array of strings
          if (Array.isArray(habits) && habits.length > 0) {
             habits = habits.slice(0, 6).map(h => String(h).trim());
          } else {
             throw new Error("Parsed JSON was not an array");
          }
        } catch (err) {
          console.error("Failed to parse habits", err, "Raw part:", jsonPart);
          habits = ["Morning routine", "Deep work 2hr", "Exercise", "Read 30 min", "Reflect/journal"];
        }

        // Allow user 1.5 seconds to read the final message before switching screens
        setTimeout(() => {
          onComplete?.(habits);
        }, 1500);

      } else {
        setMessages(prev => [...prev, { role: 'ai', text: aiResponse, time: formatTime(new Date()) }]);
      }
    } catch (err) {
      console.error("HabitSetup: Request error");
      
      // Smart Fallback
      if (newMessages.length > 4) {
        // If the conversation is deep enough, extract user text to figure out what they want
        const allUserText = newMessages.filter(m => m.role === 'user').map(m => m.text).join(' ');
        const fallbackText = "Looks like I'm having a little trouble connecting right now, but based on what you told me, I've got enough to start! Building your tracker...";
        setMessages(prev => [...prev, { role: 'ai', text: fallbackText, time: formatTime(new Date()) }]);
        
        setTimeout(() => {
          onComplete?.(getFallbackHabits(allUserText + ' ' + goalTitle));
        }, 2000);
      } else {
        setMessages(prev => [...prev, { 
          role: 'ai', 
          text: "Sorry, I had a little technical hiccup. Could you say that again?", 
          time: formatTime(new Date()) 
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#111111] text-white font-sans max-w-3xl mx-auto border-x border-white/5 relative">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-[#161616]">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-800 border border-white/10 text-zinc-300">
          <span className="text-xl leading-none">🤖</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white">Coach Sync</h1>
          <p className="text-[10px] text-emerald-400">Online</p>
        </div>
      </header>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth pb-32"
      >
        {messages.map((msg, i) => {
          const isAi = msg.role === 'ai';
          return (
            <div 
              key={i} 
              className={`flex items-end gap-2.5 max-w-[85%] sm:max-w-[75%] ${isAi ? 'self-start' : 'self-end ml-auto flex-row-reverse'}`}
              style={{ animation: 'slideIn 0.3s ease-out forwards' }}
            >
              {isAi && (
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] text-zinc-300 mb-4 sm:mb-5">
                  🤖
                </div>
              )}
              <div className={`flex flex-col ${isAi ? 'items-start' : 'items-end'}`}>
                <div 
                  className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap ${
                    isAi 
                      ? 'bg-[#222222] text-[#e0e0e0] rounded-bl-sm border border-white/5' 
                      : 'bg-emerald-600 text-white rounded-br-sm'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-zinc-500 mt-1.5 px-1">{msg.time}</span>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {loading && (
          <div 
            className="flex items-end gap-2.5 max-w-[85%] self-start"
            style={{ animation: 'slideIn 0.3s ease-out forwards' }}
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] text-zinc-300 mb-4">
              🤖
            </div>
            <div className="flex flex-col items-start">
              <div className="flex gap-1.5 items-center px-4 py-3.5 bg-[#222222] rounded-2xl w-fit rounded-bl-sm border border-white/5">
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-[bounce_1s_infinite]" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-[bounce_1s_infinite]" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-[bounce_1s_infinite]" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#111] via-[#111] to-transparent pt-8">
        <form 
          onSubmit={handleSend}
          className="flex items-center gap-2 bg-[#1c1c1c] border border-white/10 rounded-full pl-4 pr-1.5 py-1.5 max-w-2xl mx-auto shadow-xl transition-all focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10"
        >
          <input
            type="text"
            value={inputTimer}
            onChange={(e) => setInputTimer(e.target.value)}
            disabled={loading}
            maxLength={CHAT_INPUT_MAX}
            placeholder={loading ? 'Coach is typing...' : 'Type your answer...'}
            className="flex-1 bg-transparent text-[15px] text-white placeholder-[#666] outline-none disabled:opacity-50 py-1"
          />
          <button
            type="submit"
            disabled={!inputTimer.trim() || loading}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:bg-white/10 disabled:text-white/30"
          >
            <svg className="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>

      <style>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(15px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
