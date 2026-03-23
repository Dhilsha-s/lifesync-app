import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { sanitizeForHTML } from '../lib/validation';
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
  // 🔒 SECURITY: Sanitize the display name to prevent XSS
  const displayName = sanitizeForHTML(name.trim() || 'there');
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
          cursor.setHours(0, 0, 0, 0);

          if (activeDates.has(formatLocalYYYYMMDD(cursor))) {
            while (activeDates.has(formatLocalYYYYMMDD(cursor))) {
              streak++;
              cursor.setDate(cursor.getDate() - 1);
            }
          } else {
            cursor.setDate(cursor.getDate() - 1);
            while (activeDates.has(formatLocalYYYYMMDD(cursor))) {
              streak++;
              cursor.setDate(cursor.getDate() - 1);
            }
          }

          // Tasks done this week
          const startOfWeek = new Date();
          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
          startOfWeek.setHours(0, 0, 0, 0);

          const tasksDoneThisWeek = userTasks ? userTasks.filter(t => t.status === 'done' && new Date(t.created_at) >= startOfWeek).length : 0;

          setStats({
            todayProgress: progress,
            currentStreak: streak,
            tasksDone: tasksDoneThisWeek
          });
        }
      } catch (e) {
        console.error("Dashboard: Failed to fetch data", e);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [userId]);

  const toggleTask = async (id, currentStatus) => {
    const newStatus = currentStatus === 'done' ? 'open' : 'done';
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
    if (error) {
      console.error("Dashboard: Failed to update task", error);
      // Revert optimistic update on error
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: currentStatus } : t));
    }
  };

  if (loading) {
    return (
      <AppShell activeTab="home" onNavigate={onNavigate}>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="w-8 h-8 border-2 border-border border-t-lime rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="home" onNavigate={onNavigate}>
      <div className="space-y-8 animate-in fade-in duration-700">
        
        {/* Top Greeting Card */}
        <section className="rounded-[16px] bg-lime border border-lime p-8 md:p-10 relative overflow-hidden text-bg">
          <div className="relative z-10">
            <p className="text-bg/70 text-sm font-bold mb-2 uppercase tracking-widest">{displayDate}</p>
            {/* 🔒 SECURITY: User name is already sanitized above */}
            <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">{greeting}, {displayName}! 👋</h1>
            <p className="text-bg/80 text-lg max-w-2xl font-medium">"{selectedQuote}"</p>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-20">
            <svg className="w-32 h-32 text-bg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L4 9v12h16V9l-8-6zm0 2.2L18.8 10v10H5.2V10L12 5.2z"/></svg>
          </div>
        </section>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-[16px] p-6 flex items-center justify-between transition-colors hover:border-lime/50">
            <div>
              <p className="text-text-muted text-xs font-bold uppercase tracking-wider mb-1">Today's Progress</p>
              <h3 className="text-[48px] font-black leading-none text-white tracking-tighter">{todayProgress}%</h3>
            </div>
            <div className="w-full max-w-[80px] mt-4 self-end">
              <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                <div className="h-full bg-lime transition-all duration-1000" style={{ width: `${todayProgress}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-[16px] p-6 flex items-center justify-between transition-colors hover:border-yellow/50">
            <div>
              <p className="text-text-muted text-xs font-bold uppercase tracking-wider mb-1">Current Streak</p>
              <h3 className="text-4xl font-black text-yellow tracking-tighter">{stats.currentStreak}</h3>
              <p className="text-text-muted text-sm font-medium mt-1">Days 🔥</p>
            </div>
            <div className="bg-yellow/10 p-4 rounded-xl text-3xl">🔥</div>
          </div>

          <div className="bg-pink border border-pink rounded-[16px] p-6 flex items-center justify-between text-white transition-opacity hover:opacity-90">
            <div>
              <p className="text-white/70 text-xs font-bold uppercase tracking-wider mb-1">Tasks Done (Week)</p>
              <h3 className="text-4xl font-black tracking-tighter">{stats.tasksDone}</h3>
              <p className="text-white/80 text-sm font-medium mt-1">Completed ✅</p>
            </div>
            <div className="bg-white/20 p-4 rounded-xl text-3xl">🎯</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white tracking-tight">Today's Focus</h2>
            </div>
            
            <div className="space-y-3">
              {tasks.length > 0 ? (
                tasks.map(task => (
                  <div key={task.id} className={`group border rounded-[14px] p-4 flex items-center justify-between transition-all duration-150 ${task.status === 'done' ? 'bg-[#141f0a] border-lime/20' : 'bg-[#141414] border-border hover:border-lime/50'}`}>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => toggleTask(task.id, task.status)}
                        className={`w-[44px] h-[44px] shrink-0 rounded-xl border-2 flex items-center justify-center transition-colors ${
                          task.status === 'done' ? 'bg-lime border-lime text-bg' : 'border-border bg-transparent hover:border-lime'
                        }`}
                      >
                        {task.status === 'done' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                      </button>
                      {/* 🔒 SECURITY: Sanitize task title to prevent XSS */}
                      <span className={`font-bold text-lg tracking-tight ${task.status === 'done' ? 'text-text-muted line-through' : 'text-white'}`}>
                        {sanitizeForHTML(task.title || '')}
                      </span>
                    </div>
                    <button className="text-text-muted hover:text-white font-bold text-sm uppercase tracking-wider px-4 min-h-[44px] transition-colors">Skip</button>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center bg-[#141414] border border-dashed border-border rounded-[14px]">
                  <p className="text-text-muted font-bold">No tasks for today. Take it easy!</p>
                </div>
              )}
              
              <button className="w-full min-h-[44px] border border-dashed border-border rounded-[14px] text-text-muted hover:text-lime hover:border-lime hover:bg-lime/5 transition-all text-sm font-bold uppercase tracking-widest">
                + Add task
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white tracking-tight">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => onNavigate('focus')} className="flex items-center gap-4 p-4 min-h-[44px] bg-card border border-border hover:border-lime hover:bg-[#1a1a1a] rounded-[14px] transition-all group text-left">
                <div className="w-[44px] h-[44px] shrink-0 bg-lime text-bg rounded-xl flex items-center justify-center text-xl font-bold">⏱</div>
                <div>
                  <p className="font-bold text-white flex items-center gap-2 tracking-tight">Focus Session <span className="opacity-0 group-hover:opacity-100 transition-opacity text-lime">→</span></p>
                  <p className="text-xs text-text-muted font-medium mt-0.5">Start a deep work block</p>
                </div>
              </button>

              <button onClick={() => onNavigate('goals')} className="flex items-center gap-4 p-4 min-h-[44px] bg-card border border-border hover:border-cyan hover:bg-[#1a1a1a] rounded-[14px] transition-all group text-left">
                <div className="w-[44px] h-[44px] shrink-0 bg-surface text-cyan rounded-xl flex items-center justify-center text-xl font-bold border border-cyan/20">📋</div>
                <div>
                  <p className="font-bold text-white flex items-center gap-2 tracking-tight">My Goals <span className="opacity-0 group-hover:opacity-100 transition-opacity text-cyan">→</span></p>
                  <p className="text-xs text-text-muted font-medium mt-0.5">Review your milestones</p>
                </div>
              </button>

              <button onClick={() => onNavigate('habits')} className="flex items-center gap-4 p-4 min-h-[44px] bg-card border border-border hover:border-pink hover:bg-[#1a1a1a] rounded-[14px] transition-all group text-left">
                <div className="w-[44px] h-[44px] shrink-0 bg-surface text-pink rounded-xl flex items-center justify-center text-xl font-bold border border-pink/20">🎯</div>
                <div>
                  <p className="font-bold text-white flex items-center gap-2 tracking-tight">Check Habits <span className="opacity-0 group-hover:opacity-100 transition-opacity text-pink">→</span></p>
                  <p className="text-xs text-text-muted font-medium mt-0.5">Log your daily wins</p>
                </div>
              </button>

              <button onClick={() => onNavigate('analytics')} className="flex items-center gap-4 p-4 min-h-[44px] bg-card border border-border hover:border-yellow hover:bg-[#1a1a1a] rounded-[14px] transition-all group text-left">
                <div className="w-[44px] h-[44px] shrink-0 bg-surface text-yellow rounded-xl flex items-center justify-center text-xl font-bold border border-yellow/20">📈</div>
                <div>
                  <p className="font-bold text-white flex items-center gap-2 tracking-tight">View Analytics <span className="opacity-0 group-hover:opacity-100 transition-opacity text-yellow">→</span></p>
                  <p className="text-xs text-text-muted font-medium mt-0.5">See your progress data</p>
                </div>
              </button>
            </div>
            
            <div className="bg-surface border border-border p-5 rounded-[14px] flex items-start gap-4 hover:border-lime/50 transition-colors">
              <div className="w-[44px] h-[44px] shrink-0 bg-lime/10 text-lime rounded-full flex items-center justify-center text-xl font-bold">✨</div>
              <div>
                <p className="text-white font-bold tracking-tight mb-1">Week Milestone</p>
                <p className="text-text-muted text-sm font-medium line-clamp-2">Stay consistent! You've completed {stats.tasksDone} tasks so far.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}