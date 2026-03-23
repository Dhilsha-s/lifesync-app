import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import AppShell from '../components/AppShell';
import { createRateLimiter } from '../lib/rateLimiter';

const replanLimiter = createRateLimiter(5, 60_000); // 5 replans per minute

const DEFAULT_GOAL_TITLE = 'Get placed in a top company';

function formatLocalYYYYMMDD(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

function formatDeadlinePeriod(deadline) {
  if (!deadline) return '—';
  try {
    const d = new Date(deadline + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function getCurrentWeekString() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function getSliderColor(progress) {
  if (progress <= 33) return 'bg-red-500';
  if (progress <= 66) return 'bg-yellow-500';
  return 'bg-emerald-500';
}

export default function GoalPlanner({ onNavigate, initialMilestones = null, goalTitle = '', deadline = '', userId, groqKey }) {
  const [loading, setLoading] = useState(true);
  const [replanLoading, setReplanLoading] = useState(false);
  const [milestoneData, setMilestoneData] = useState(null);
  const [habits, setHabits] = useState([]);
  const [rows, setRows] = useState([]);
  const [spotlight, setSpotlight] = useState({ x: -999, y: -999 });
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState('just now');
  const lastFetchedAt = useRef(null);


  const title = goalTitle.trim() || DEFAULT_GOAL_TITLE;

  useEffect(() => {
    const move = (e) => setSpotlight({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!userId) { setLoading(false); return; }
      try {
        const [milestoneRes, habitsRes] = await Promise.all([
          supabase.from('milestones').select('*').eq('user_id', userId).single(),
          supabase.from('habits').select('date, completed, habit_name').eq('user_id', userId)
        ]);
        if (milestoneRes.data) setMilestoneData(milestoneRes.data);
        else if (initialMilestones) setMilestoneData(initialMilestones);
        if (habitsRes.data) setHabits(habitsRes.data);
        lastFetchedAt.current = Date.now();
        setLastUpdatedLabel('just now');
      } catch (err) { console.error("GoalPlanner: Failed to fetch data"); } finally { setLoading(false); }
    }
    fetchData();
  }, [userId, initialMilestones]);

  // Keep the "Last updated" label fresh
  useEffect(() => {
    const timer = setInterval(() => {
      if (!lastFetchedAt.current) return;
      const seconds = Math.round((Date.now() - lastFetchedAt.current) / 1000);
      if (seconds < 10) setLastUpdatedLabel('just now');
      else if (seconds < 60) setLastUpdatedLabel(`${seconds}s ago`);
      else setLastUpdatedLabel(`${Math.floor(seconds / 60)}m ago`);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const calculateAutoProgress = (id) => {
    if (habits.length === 0) return 0;
    const uniqueHabits = new Set(habits.map(h => h.habit_name));
    const totalHabitCountPerDay = uniqueHabits.size || 6;
    const todayStr = formatLocalYYYYMMDD(new Date());

    if (id === 'day') {
      const todayHabits = habits.filter(h => h.date === todayStr);
      const done = todayHabits.filter(h => h.completed).length;
      return totalHabitCountPerDay ? Math.round((done / totalHabitCountPerDay) * 100) : 0;
    }
    if (id === 'week') {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(new Date().getDate() - i);
        return formatLocalYYYYMMDD(d);
      });
      const weekHabits = habits.filter(h => last7Days.includes(h.date));
      return Math.round((weekHabits.filter(h => h.completed).length / (totalHabitCountPerDay * 7)) * 100);
    }
    if (id === 'month') {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthHabits = habits.filter(h => new Date(h.date) >= monthStart);
      return Math.round((monthHabits.filter(h => h.completed).length / (totalHabitCountPerDay * now.getDate())) * 100);
    }
    if (id === 'year') {
      const habitsByDate = habits.reduce((acc, h) => { acc[h.date] = (acc[h.date] || 0) + (h.completed ? 1 : 0); return acc; }, {});
      const distinctDates = Object.keys(habitsByDate).sort();
      if (distinctDates.length === 0) return 0;
      const start = new Date(distinctDates[0]), end = new Date();
      const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) || 1;
      return Math.min(100, Math.round((Object.values(habitsByDate).filter(count => count > 0).length / diffDays) * 100));
    }
    return 0;
  };

  useEffect(() => {
    if (milestoneData) {
      const tiers = ['year', 'month', 'week', 'day'];
      const newRows = tiers.map(tier => ({
        id: tier,
        level: tier.charAt(0).toUpperCase() + tier.slice(1),
        period: tier === 'day' ? 'Today' : (tier === 'week' ? getCurrentWeekString() : (tier === 'month' ? formatDeadlinePeriod(deadline) : String(new Date().getFullYear()))),
        milestone: milestoneData[`${tier}_milestone`] || milestoneData[tier] || '',
        progress: calculateAutoProgress(tier),
      }));
      setRows(newRows);
    }
  }, [milestoneData, habits, deadline]);

  const handleReplan = async () => {
    if (!groqKey && !process.env.REACT_APP_GROQ_KEY) return;
    
    const { allowed, retryAfterMs } = replanLimiter.checkLimit();
    if (!allowed) {
      const secs = Math.ceil(retryAfterMs / 1000);
      alert(`Please wait ${secs}s before re-planning again.`);
      return;
    }

    setReplanLoading(true);
    try {
      const prompt = `Goal: "${title}". Suggest revised plan. Return JSON: {"year": "...", "month": "...", "week": "...", "day": "..."}`;
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey || process.env.REACT_APP_GROQ_KEY}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: prompt }] }),
      });
      const content = (await response.json()).choices[0].message.content;
      const parsed = JSON.parse(content.match(/\{[\s\S]*?\}/)[0]);
      if (parsed.year) {
        setRows(prev => prev.map(r => ({ ...r, milestone: parsed[r.id] })));
        if (userId) await supabase.from('milestones').update({ year_milestone: parsed.year, month_milestone: parsed.month, week_milestone: parsed.week, day_milestone: parsed.day }).eq('user_id', userId);
      }
    } catch (err) { console.error("GoalPlanner: Re-plan failed"); } finally { setReplanLoading(false); }
  };

  const overallProgress = rows.length ? Math.round(rows.reduce((acc, row) => acc + row.progress, 0) / rows.length) : 0;

  if (loading) {
    return (
      <AppShell activeTab="goals" onNavigate={onNavigate}>
        <div className="flex h-[50vh] items-center justify-center"><div className="w-8 h-8 border-2 border-[#333333] border-t-emerald-500 rounded-full animate-spin" /></div>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="goals" onNavigate={onNavigate}>
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: `radial-gradient(600px circle at ${spotlight.x}px ${spotlight.y}px, rgba(16,185,129,0.06), transparent 70%)` }} />
      <div className="relative z-10 space-y-10 max-w-6xl mx-auto py-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5"><div className="space-y-4 text-center md:text-left"><div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Target Reached: {overallProgress}%</div><h1 className="text-4xl md:text-6xl font-bold text-white tracking-tighter leading-tight max-w-2xl">{title}</h1><p className="text-zinc-500 text-lg">Your master plan, broken down for clarity.</p></div><button onClick={handleReplan} disabled={replanLoading} className="px-8 py-4 bg-white text-black rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-[0.98] disabled:opacity-50">{replanLoading ? 'Planning...' : '🔄 Re-plan with AI'}</button></header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">{rows.map((row) => (<div key={row.id} className="bg-[#1a1a1a] border border-[#2a2a2a] p-8 rounded-3xl space-y-6 relative overflow-hidden group"><div className="flex justify-between items-start mb-2"><div className="space-y-1"><p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{row.level} Goal</p><p className="text-zinc-400 text-xs">{row.period}</p></div><div className="bg-white/5 p-2 rounded-xl group-hover:bg-emerald-500/10 transition-colors">🎯</div></div><h3 className="text-xl font-bold text-white leading-relaxed">{row.milestone}</h3><div className="space-y-3"><div className="flex justify-between text-xs font-bold text-zinc-500 uppercase tracking-tighter"><span>Progress</span><span>{row.progress}%</span></div><div className="h-2 w-full bg-[#111] rounded-full overflow-hidden"><div className={`h-full ${getSliderColor(row.progress)} transition-all duration-1000`} style={{ width: `${row.progress}%` }} /></div><p className="text-[10px] text-zinc-600 font-medium">Last updated: {lastUpdatedLabel}</p></div></div>))}</div>
      </div>
    </AppShell>
  );
}