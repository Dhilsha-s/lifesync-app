import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import AppShell from '../components/AppShell';
import { createRateLimiter } from '../lib/rateLimiter';
import Groq from 'groq-sdk';

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
    if (!userId || replanLoading) return;
    
    const { allowed, retryAfterMs } = replanLimiter.checkLimit();
    if (!allowed) {
      const secs = Math.ceil(retryAfterMs / 1000);
      alert(`Please wait ${secs}s before re-planning again.`);
      return;
    }

    setReplanLoading(true);
    try {
      const client = new Groq({ 
        apiKey: process.env.REACT_APP_GROQ_KEY, 
        dangerouslyAllowBrowser: true 
      });

      const daysLeft = deadline ? Math.max(0, Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24))) : 0;

      const prompt = `You are a goal planning assistant.
User's goal: "${title}"
Deadline: ${deadline} (${daysLeft} days remaining)

Create a realistic milestone plan. 
Respond ONLY with this exact JSON, no other text:
{
  "year_milestone": "one sentence describing what to achieve by end of year",
  "month_milestone": "one sentence describing what to achieve this month",
  "week_milestone": "one sentence describing what to achieve this week",
  "day_milestone": "one sentence describing what to do today"
}`;

      const res = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: 'You are a goal planning assistant. Always respond with valid JSON only. No markdown, no explanation, just the JSON object.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const text = res.choices[0]?.message?.content?.trim() || '';
      
      const cleaned = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      
      const plan = JSON.parse(jsonMatch[0]);

      const requiredFields = [
        'year_milestone', 
        'month_milestone', 
        'week_milestone', 
        'day_milestone'
      ];
      
      for (const field of requiredFields) {
        if (!plan[field] || typeof plan[field] !== 'string') {
          throw new Error(`Invalid field: ${field}`);
        }
      }

      const update = {
        year_milestone: plan.year_milestone,
        month_milestone: plan.month_milestone,
        week_milestone: plan.week_milestone,
        day_milestone: plan.day_milestone,
        year_progress: milestoneData?.year_progress || 0,
        month_progress: milestoneData?.month_progress || 0,
        week_progress: milestoneData?.week_progress || 0,
        day_progress: milestoneData?.day_progress || 0,
      };

      await supabase
        .from('milestones')
        .update(update)
        .eq('user_id', userId);

      setMilestoneData(prev => ({ ...prev, ...update }));

    } catch (err) {
      console.error('Replan failed:', err);
      alert('Failed to generate plan. Please try again.');
    }
    setReplanLoading(false);
  };

  const getTierColor = (level) => {
    switch (level.toLowerCase()) {
      case 'year': return 'lime';
      case 'month': return 'cyan';
      case 'week': return 'yellow';
      case 'day': return 'pink';
      default: return 'text-primary';
    }
  };

  const getTierBgColor = (level) => {
    switch (level.toLowerCase()) {
      case 'year': return 'bg-lime';
      case 'month': return 'bg-cyan';
      case 'week': return 'bg-yellow';
      case 'day': return 'bg-pink';
      default: return 'bg-border';
    }
  };

  const milestones = milestoneData;
  const overallProgress = milestones
    ? Math.round(
        (
          (milestones.year_progress || 0) +
          (milestones.month_progress || 0) +
          (milestones.week_progress || 0) +
          (milestones.day_progress || 0)
        ) / 4
      )
    : 0;

  if (loading) {
    return (
      <AppShell activeTab="goals" onNavigate={onNavigate}>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="w-8 h-8 border-2 border-border border-t-lime rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="goals" onNavigate={onNavigate}>
      <div className="relative z-10 space-y-10 max-w-6xl mx-auto py-10 animate-in fade-in duration-700">
        
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border">
          <div className="space-y-4 text-center md:text-left">
            <div className={`inline-flex items-center gap-2 px-3 py-1 bg-lime/10 border border-lime/20 rounded-full text-[10px] font-bold text-lime uppercase tracking-widest`}>
              Target Reached: {overallProgress}%
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-tight max-w-2xl">
              {title}
            </h1>
            <p className="text-text-muted text-lg font-medium">Your master plan, broken down for clarity.</p>
          </div>
          
          <button 
            onClick={handleReplan} 
            disabled={replanLoading} 
            className="px-8 min-h-[54px] bg-lime text-bg rounded-[14px] font-bold hover:bg-lime/90 transition-all focus:outline-none disabled:opacity-50 tracking-wide"
          >
            {replanLoading ? 'Planning...' : '🔄 Re-plan with AI'}
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rows.map((row) => {
            const colorClass = getTierColor(row.level);
            const bgClass = getTierBgColor(row.level);
            
            return (
              <div key={row.id} className="bg-card border border-border p-8 rounded-[16px] space-y-6 relative group transition-colors hover:border-text-dim">
                <div className="flex justify-between items-start mb-2">
                  <div className="space-y-1">
                    <p className={`text-${colorClass} text-[10px] font-bold uppercase tracking-widest`}>{row.level} Goal</p>
                    <p className="text-text-muted text-xs font-medium">{row.period}</p>
                  </div>
                  <div className={`text-${colorClass} bg-${colorClass}/10 p-2 rounded-xl text-xl font-bold`}>
                    🎯
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-white leading-relaxed">
                  {row.milestone}
                </h3>
                
                <div className="space-y-3 pt-4 border-t border-border/50">
                  <div className="flex justify-between text-xs font-bold text-text-muted uppercase tracking-wider">
                    <span>Progress</span>
                    <span className={`text-${colorClass}`}>{row.progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                    <div className={`h-full ${bgClass} transition-all duration-1000`} style={{ width: `${row.progress}%` }} />
                  </div>
                  <p className="text-[10px] text-text-dim font-medium uppercase tracking-widest">
                    Last updated: {lastUpdatedLabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}