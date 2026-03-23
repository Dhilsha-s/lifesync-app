import { useEffect, useState } from 'react';
import { useCountUp } from '../hooks/useCountUp';
import { supabase } from '../lib/supabase';
import AppShell from '../components/AppShell';
import { createRateLimiter } from '../lib/rateLimiter';

const insightLimiter = createRateLimiter(5, 60_000);

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dotClass(status) {
  if (status === 'completed') return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
  if (status === 'missed') return 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]';
  return 'bg-zinc-700';
}

function formatLocalYYYYMMDD(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

export default function Analytics({ onNavigate, userId, groqKey }) {
  const [dataLoading, setDataLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);
  
  const [stats, setStats] = useState({ totalTasksDone: 0, currentStreak: 0, bestStreak: 0 });
  const [weeklyData, setWeeklyData] = useState([0,0,0,0,0,0,0]);
  const [streakGrid, setStreakGrid] = useState([[],[],[],[]]);
  const [insights, setInsights] = useState([]);

  const countTotal   = useCountUp(stats.totalTasksDone, 1000);
  const countCurrent = useCountUp(stats.currentStreak, 900);
  const countBest    = useCountUp(stats.bestStreak, 1100);

  const [spotlight, setSpotlight] = useState({ x: -999, y: -999 });

  useEffect(() => {
    const move = (e) => setSpotlight({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  useEffect(() => {
    async function fetchAnalytics() {
      if (!userId) return;
      try {
        setDataLoading(true);
        const { data: tasksData } = await supabase.from('tasks').select('*').eq('user_id', userId);
        const totalTasks = tasksData ? tasksData.filter(t => t.status === 'done').length : 0;

        const { data: habitsData } = await supabase.from('habits').select('*').eq('user_id', userId);
        const activeDates = new Set();
        if (habitsData) habitsData.forEach(h => { if (h.completed) activeDates.add(h.date); });

        const today = new Date();
        today.setHours(0,0,0,0);
        const todayStr = formatLocalYYYYMMDD(today);

        let currentStreak = 0;
        let cursor = new Date(today);
        if (activeDates.has(todayStr)) {
          while(activeDates.has(formatLocalYYYYMMDD(cursor))) { currentStreak++; cursor.setDate(cursor.getDate() - 1); }
        } else {
          cursor.setDate(cursor.getDate() - 1);
          while(activeDates.has(formatLocalYYYYMMDD(cursor))) { currentStreak++; cursor.setDate(cursor.getDate() - 1); }
        }

        const sortedDates = Array.from(activeDates).sort();
        let bestStreak = 0, tempStreak = 0, prevDate = null;
        for (const dateStr of sortedDates) {
          const d = new Date(dateStr); d.setHours(0,0,0,0);
          if (!prevDate) tempStreak = 1;
          else {
            const diffDays = Math.round((d - prevDate) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) tempStreak++;
            else if (diffDays > 1) tempStreak = 1;
          }
          prevDate = d;
          if (tempStreak > bestStreak) bestStreak = tempStreak;
        }

        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(today);
        monday.setDate(today.getDate() - daysToMonday);

        const newWeeklyData = Array(7).fill(0);
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday); d.setDate(monday.getDate() + i);
          const dStr = formatLocalYYYYMMDD(d);
          if (d <= today) {
            const habitsOnDay = habitsData ? habitsData.filter(h => h.date === dStr) : [];
            if (habitsOnDay.length > 0) newWeeklyData[i] = Math.round((habitsOnDay.filter(h => h.completed).length / habitsOnDay.length) * 100);
          }
        }

        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        const gridDays = [];
        for (let i = 27; i >= 0; i--) {
          const d = new Date(sunday); d.setDate(sunday.getDate() - i);
          const dStr = formatLocalYYYYMMDD(d);
          let status = 'future';
          if (d <= today) status = activeDates.has(dStr) ? 'completed' : 'missed';
          gridDays.push(status);
        }

        const newStreakGrid = [];
        for (let i = 0; i < 4; i++) newStreakGrid.push(gridDays.slice(i * 7, (i + 1) * 7));

        setStats({ totalTasksDone: totalTasks, currentStreak, bestStreak });
        setWeeklyData(newWeeklyData);
        setStreakGrid(newStreakGrid);
        setDataLoading(false);
        fetchInsights(totalTasks, currentStreak, bestStreak, newWeeklyData);
      } catch (err) { console.error("Analytics: Failed to fetch analytics"); setDataLoading(false); }
    }

    async function fetchInsights(totalTasks, currentStreak, bestStreak, newWeeklyData) {
      if (!groqKey && !process.env.REACT_APP_GROQ_KEY) return;
      
      const { allowed } = insightLimiter.checkLimit();
      if (!allowed) return; // Silent fail for automatic insights

      try {
        setInsightsLoading(true);
        const systemPrompt = `Analyze productivity: Tasks: ${totalTasks}, Current Streak: ${currentStreak}, Best: ${bestStreak}, Weekly: ${JSON.stringify(newWeeklyData)}. Return 3 objects: {title, icon, body} in a JSON array.`;
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey || process.env.REACT_APP_GROQ_KEY}` },
          body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: systemPrompt }] }),
        });
        const payload = await response.json();
        const match = payload.choices[0].message.content.match(/\[[\s\S]*?\]/);
        const parsed = match ? JSON.parse(match[0]) : JSON.parse(payload.choices[0].message.content);
        if (Array.isArray(parsed)) setInsights(parsed);
      } catch (err) { console.error("Analytics: Failed to fetch insights"); } finally { setInsightsLoading(false); }
    }
    fetchAnalytics();
  }, [userId, groqKey]);

  if (dataLoading) {
    return (
      <AppShell activeTab="analytics" onNavigate={onNavigate}>
        <div className="space-y-6 animate-pulse max-w-5xl mx-auto"><div className="h-24 bg-white/5 rounded-2xl w-full"/><div className="grid grid-cols-3 gap-3"><div className="h-32 bg-white/5 rounded-2xl"/><div className="h-32 bg-white/5 rounded-2xl"/><div className="h-32 bg-white/5 rounded-2xl"/></div><div className="h-64 bg-white/5 rounded-2xl w-full"/></div>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="analytics" onNavigate={onNavigate}>
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: `radial-gradient(600px circle at ${spotlight.x}px ${spotlight.y}px, rgba(16,185,129,0.06), transparent 70%)` }} />
      <div className="relative z-10 space-y-10 max-w-5xl mx-auto py-10">
        <header className="space-y-2"><h1 className="text-4xl font-bold text-white tracking-tight">Analytics</h1><p className="text-zinc-500">Your journey, mapped in data.</p></header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-8 rounded-3xl"><p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Total Tasks Done</p><h3 className="text-5xl font-bold text-white tracking-tighter">{countTotal}</h3></div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-8 rounded-3xl"><p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Current Streak</p><h3 className="text-5xl font-bold text-emerald-400 tracking-tighter">{countCurrent} 🔥</h3></div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-8 rounded-3xl"><p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Best Streak</p><h3 className="text-5xl font-bold text-white tracking-tighter">{countBest}</h3></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-8 rounded-3xl space-y-8"><h3 className="text-xl font-bold text-white mb-2">Weekly Performance</h3><div className="flex items-end justify-between h-48 gap-4 px-2">{weeklyData.map((pct, i) => (<div key={i} className="flex-1 flex flex-col items-center gap-3"><div className="w-full bg-emerald-500/10 rounded-full relative overflow-hidden h-full"><div className="absolute bottom-0 left-0 right-0 bg-emerald-500 transition-all duration-1000 ease-out rounded-full" style={{ height: `${pct}%` }} /></div><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{DAY_LABELS[i]}</span></div>))}</div></div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-8 rounded-3xl space-y-8"><h3 className="text-xl font-bold text-white mb-2">Last 4 Weeks</h3><div className="grid grid-rows-4 gap-3">{streakGrid.map((week, wi) => (<div key={wi} className="flex justify-between">{week.map((status, di) => (<div key={di} className={`w-8 h-8 rounded-lg transition-all duration-500 ${dotClass(status)}`} />))}</div>))}</div></div>
        </div>
        <div className="space-y-6 py-6"><h3 className="text-xl font-bold text-white">AI Coach Insights</h3>{insightsLoading ? (<div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">{[1,2,3].map(i => (<div key={i} className="h-32 bg-white/5 rounded-2xl" />))}</div>) : (<div className="grid grid-cols-1 md:grid-cols-3 gap-4">{insights.map((insight, i) => (<div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] p-6 rounded-2xl space-y-3 shadow-xl"><div className="flex items-center justify-between"><span className="text-2xl">{insight.icon}</span><span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Growth</span></div><h4 className="font-bold text-white">{insight.title}</h4><p className="text-sm text-zinc-400 leading-relaxed">{insight.body}</p></div>))}</div>)}</div>
      </div>
    </AppShell>
  );
}