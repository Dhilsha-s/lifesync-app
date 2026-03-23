import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import AppShell from '../components/AppShell';

function formatLocalYYYYMMDD(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

const QUOTES = [
  "We are what we repeatedly do. Excellence, then, is not an act, but a habit. — Aristotle",
  "The secret of getting ahead is getting started. — Mark Twain",
  "It does not matter how slowly you go as long as you do not stop. — Confucius",
  "You do not rise to the level of your goals. You fall to the level of your systems. — James Clear",
  "Motivation is what gets you started. Habit is what keeps you going. — Jim Ryun"
];

export default function Dashboard({ name = '', userId, onNavigate }) {
  const displayName = name.trim() || 'there';
  const today = new Date();
  
  const hours = today.getHours();
  let greeting = 'Good morning';
  if (hours >= 12 && hours < 17) greeting = 'Good afternoon';
  else if (hours >= 17) greeting = 'Good evening';
  
  const displayDate = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const selectedQuote = React.useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);

  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ todayProgress: 0, currentStreak: 0, tasksDone: 0 });
  const [loading, setLoading] = useState(true);
  const [todayProgress, setTodayProgress] = useState(0);

  useEffect(() => {
    async function fetchDashboard() {
      if (!userId) { setLoading(false); return; }
      try {
        setLoading(true);
        
        // 1. Fetch Today's Tasks
        const { data: userTasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        if (userTasks) setTasks(userTasks.slice(0, 10));

        // 2. Fetch Habits for Progress & Streak
        const { data: habits } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', userId);

        if (habits) {
          const todayStr = formatLocalYYYYMMDD(new Date());
          const habitsToday = habits.filter(h => h.date === todayStr);
          const doneToday = habitsToday.filter(h => h.completed).length;
          const totalToday = habitsToday.length || 1;
          const progress = Math.round((doneToday / totalToday) * 100);
          setTodayProgress(progress);

          // Streak
          const activeDates = new Set(habits.filter(h => h.completed).map(h => h.date));
          let streak = 0;
          let cursor = new Date();
          cursor.setHours(0,0,0,0);
          
          if (activeDates.has(formatLocalYYYYMMDD(cursor))) {
            while(activeDates.has(formatLocalYYYYMMDD(cursor))) {
              streak++;
              cursor.setDate(cursor.getDate() - 1);
            }
          } else {
            cursor.setDate(cursor.getDate() - 1);
            while(activeDates.has(formatLocalYYYYMMDD(cursor))) {
              streak++;
              cursor.setDate(cursor.getDate() - 1);
            }
          }

          // Tasks done this week
          const startOfWeek = new Date();
          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
          startOfWeek.setHours(0,0,0,0);
          
          const tasksDoneThisWeek = userTasks ? userTasks.filter(t => t.status === 'done' && new Date(t.created_at) >= startOfWeek).length : 0;

          setStats({
            todayProgress: progress,
            currentStreak: streak,
            tasksDone: tasksDoneThisWeek
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [userId]);

  const toggleTask = async (id, currentStatus) => {
    const newStatus = currentStatus === 'done' ? 'open' : 'done';
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
  };

  if (loading) {
    return (
      <AppShell activeTab="home" onNavigate={onNavigate}>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="w-8 h-8 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="home" onNavigate={onNavigate}>
      <div className="space-y-8 animate-in fade-in duration-700">
        
        {/* Top Greeting Card */}
        <section className="rounded-3xl bg-[#1a1a1a] border border-[#2a2a2a] p-8 md:p-10 shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-zinc-400 text-sm font-medium mb-2 uppercase tracking-widest">{displayDate}</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{greeting}, {displayName}! 👋</h1>
            <p className="text-zinc-400 text-lg max-w-2xl italic">"{selectedQuote}"</p>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <svg className="w-32 h-32 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L4 9v12h16V9l-8-6zm0 2.2L18.8 10v10H5.2V10L12 5.2z"/></svg>
          </div>
        </section>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Today's Progress</p>
              <h3 className="text-2xl font-bold text-white">{todayProgress}%</h3>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" stroke="#2a2a2a" strokeWidth="3" />
                <circle cx="18" cy="18" r="16" fill="none" stroke="#10b981" strokeWidth="3" 
                  strokeDasharray="100" strokeDashoffset={100 - todayProgress} strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Current Streak</p>
              <h3 className="text-2xl font-bold text-white">{stats.currentStreak} Days 🔥</h3>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-xl">
              <span className="text-2xl">🔥</span>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Tasks Done (Week)</p>
              <h3 className="text-2xl font-bold text-white">{stats.tasksDone}</h3>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-xl">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Today's Focus</h2>
            </div>
            
            <div className="space-y-3">
              {tasks.length > 0 ? (
                tasks.map(task => (
                  <div key={task.id} className="group bg-[#1a1a1a] border border-[#2a2a2a] hover:border-zinc-700 rounded-xl p-4 flex items-center justify-between transition-all">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => toggleTask(task.id, task.status)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          task.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-700 hover:border-emerald-500'
                        }`}
                      >
                        {task.status === 'done' && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>}
                      </button>
                      <span className={`font-medium ${task.status === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                        {task.title}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center bg-[#1a1a1a] border border-dashed border-[#2a2a2a] rounded-2xl">
                  <p className="text-zinc-500">No tasks for today. Take it easy!</p>
                </div>
              )}
              
              <button className="w-full py-4 border border-dashed border-[#2a2a2a] rounded-xl text-zinc-500 hover:text-emerald-500 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-sm font-bold uppercase tracking-widest">
                + Add task
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => onNavigate('focus')} className="flex items-center gap-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222222] rounded-2xl transition-all group">
                <div className="w-12 h-12 bg-emerald-500 text-black rounded-xl flex items-center justify-center text-xl shadow-lg shadow-emerald-500/10">⏱</div>
                <div className="text-left">
                  <p className="font-bold text-white group-hover:text-emerald-400 transition-colors">Focus Session</p>
                  <p className="text-xs text-zinc-500">Start a deep work block</p>
                </div>
              </button>

              <button onClick={() => onNavigate('goals')} className="flex items-center gap-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222222] rounded-2xl transition-all group">
                <div className="w-12 h-12 bg-zinc-800 text-white rounded-xl flex items-center justify-center text-xl border border-white/5">📋</div>
                <div className="text-left">
                  <p className="font-bold text-white group-hover:text-zinc-300 transition-colors">My Goals</p>
                  <p className="text-xs text-zinc-500">Review your milestones</p>
                </div>
              </button>

              <button onClick={() => onNavigate('habits')} className="flex items-center gap-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222222] rounded-2xl transition-all group">
                <div className="w-12 h-12 bg-zinc-800 text-white rounded-xl flex items-center justify-center text-xl border border-white/5">🎯</div>
                <div className="text-left">
                  <p className="font-bold text-white group-hover:text-zinc-300 transition-colors">Check Habits</p>
                  <p className="text-xs text-zinc-500">Log your daily wins</p>
                </div>
              </button>

              <button onClick={() => onNavigate('analytics')} className="flex items-center gap-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222222] rounded-2xl transition-all group">
                <div className="w-12 h-12 bg-zinc-800 text-white rounded-xl flex items-center justify-center text-xl border border-white/5">📈</div>
                <div className="text-left">
                  <p className="font-bold text-white group-hover:text-zinc-300 transition-colors">View Analytics</p>
                  <p className="text-xs text-zinc-500">See your progress data</p>
                </div>
              </button>
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
