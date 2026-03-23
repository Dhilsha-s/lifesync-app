import { useEffect, useState } from 'react';
import { useCountUp } from '../hooks/useCountUp';
import { supabase } from '../lib/supabase';
import { sanitizeForHTML } from '../lib/validation';
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

  const [stats, setStats] = useState({
    totalTasksDone: 0,
    currentStreak: 0,
    bestStreak: 0,
    achievementPoints: 0,        // ✨ NEW
    focusSessions: 0,             // ✨ NEW
    totalFocusTime: 0,            // ✨ NEW
  });
  const [weeklyData, setWeeklyData] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [streakGrid, setStreakGrid] = useState([[], [], [], []]);
  const [focusHistory, setFocusHistory] = useState([]);  // ✨ NEW
  const [insights, setInsights] = useState([]);

  const countTotal = useCountUp(stats.totalTasksDone, 1000);
  const countCurrent = useCountUp(stats.currentStreak, 900);
  const countBest = useCountUp(stats.bestStreak, 1100);
  const countPoints = useCountUp(stats.achievementPoints, 1200); // ✨ NEW

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

        // Fetch tasks
        const { data: tasksData } = await supabase.from('tasks').select('*').eq('user_id', userId);
        const totalTasks = tasksData ? tasksData.filter(t => t.status === 'done').length : 0;

        // Fetch habits
        const { data: habitsData } = await supabase.from('habits').select('*').eq('user_id', userId);
        const activeDates = new Set();
        if (habitsData) habitsData.forEach(h => { if (h.completed) activeDates.add(h.date); });

        // 📊 Fetch focus sessions for achievement points
        const { data: focusSessions } = await supabase
          .from('focus_sessions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        let totalPoints = 0;
        let totalFocusSeconds = 0;
        const lastSevenDays = [];

        if (focusSessions) {
          // Calculate total achievement points
          totalPoints = focusSessions.reduce((sum, session) => sum + (session.achievement_points || 0), 0);
          totalFocusSeconds = focusSessions.reduce((sum, session) => sum + session.duration_seconds, 0);

          // Get last 7 focus sessions for history
          lastSevenDays.push(...focusSessions.slice(0, 7));
        }

        // Calculate streak from habits
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = formatLocalYYYYMMDD(today);

        let currentStreak = 0;
        let cursor = new Date(today);
        if (activeDates.has(todayStr)) {
          while (activeDates.has(formatLocalYYYYMMDD(cursor))) {
            currentStreak++;
            cursor.setDate(cursor.getDate() - 1);
          }
        } else {
          cursor.setDate(cursor.getDate() - 1);
          while (activeDates.has(formatLocalYYYYMMDD(cursor))) {
            currentStreak++;
            cursor.setDate(cursor.getDate() - 1);
          }
        }

        // Best streak
        const sortedDates = Array.from(activeDates).sort();
        let bestStreak = 0, tempStreak = 0, prevDate = null;
        for (const dateStr of sortedDates) {
          const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
          if (!prevDate) tempStreak = 1;
          else {
            const diffDays = Math.round((d - prevDate) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) tempStreak++;
            else if (diffDays > 1) tempStreak = 1;
          }
          prevDate = d;
          if (tempStreak > bestStreak) bestStreak = tempStreak;
        }

        // Weekly performance
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
            if (habitsOnDay.length > 0) {
              const completedCount = habitsOnDay.filter(h => h.completed).length;
              const percentage = Math.round((completedCount / habitsOnDay.length) * 100);
              newWeeklyData[i] = Math.max(0, Math.min(100, percentage));
            }
          }
        }

        // Streak grid (last 4 weeks)
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

        setStats({
          totalTasksDone: totalTasks,
          currentStreak,
          bestStreak,
          achievementPoints: totalPoints,
          focusSessions: focusSessions?.length || 0,
          totalFocusTime: totalFocusSeconds,
        });
        setWeeklyData(newWeeklyData);
        setStreakGrid(newStreakGrid);
        setFocusHistory(lastSevenDays);
        setDataLoading(false);
        fetchInsights(totalTasks, currentStreak, bestStreak, newWeeklyData, totalPoints);
      } catch (err) {
        console.error("Analytics: Failed to fetch analytics", err);
        setDataLoading(false);
      }
    }

    async function fetchInsights(totalTasks, currentStreak, bestStreak, newWeeklyData, totalPoints) {
      if (!groqKey && !process.env.REACT_APP_GROQ_KEY) return;

      const { allowed } = insightLimiter.checkLimit();
      if (!allowed) return;

      try {
        setInsightsLoading(true);
        const systemPrompt = `Analyze productivity: Tasks: ${totalTasks}, Streak: ${currentStreak}, Best: ${bestStreak}, Weekly: ${JSON.stringify(newWeeklyData)}, Achievement Points: ${totalPoints}. Return 3 objects: {title, icon, body} in a JSON array.`;
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey || process.env.REACT_APP_GROQ_KEY}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'system', content: systemPrompt }]
          }),
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const payload = await response.json();
        const match = payload.choices[0].message.content.match(/\[[\s\S]*?\]/);
        const parsed = match ? JSON.parse(match[0]) : JSON.parse(payload.choices[0].message.content);

        if (Array.isArray(parsed) && parsed.length > 0) {
          setInsights(parsed);
        }
      } catch (err) {
        console.error("Analytics: Failed to fetch insights", err);
      } finally {
        setInsightsLoading(false);
      }
    }

    fetchAnalytics();
  }, [userId, groqKey]);

  if (dataLoading) {
    return (
      <AppShell activeTab="analytics" onNavigate={onNavigate}>
        <div className="space-y-6 animate-pulse max-w-5xl mx-auto">
          <div className="h-24 bg-white/5 rounded-2xl w-full" />
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl" />)}
          </div>
          <div className="h-64 bg-white/5 rounded-2xl w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="analytics" onNavigate={onNavigate}>
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: `radial-gradient(600px circle at ${spotlight.x}px ${spotlight.y}px, rgba(16,185,129,0.06), transparent 70%)` }} />
      <div className="relative z-10 space-y-10 max-w-5xl mx-auto py-10">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">Analytics</h1>
          <p className="text-zinc-500">Your journey, mapped in data.</p>
        </header>

        {/* Core Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-8 rounded-3xl">
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Total Tasks Done</p>
            <h3 className="text-5xl font-bold text-white tracking-tighter">{countTotal}</h3>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-8 rounded-3xl">
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Current Streak</p>
            <h3 className="text-5xl font-bold text-emerald-400 tracking-tighter">{countCurrent} 🔥</h3>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-8 rounded-3xl">
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Best Streak</p>
            <h3 className="text-5xl font-bold text-white tracking-tighter">{countBest}</h3>
          </div>
        </div>

        {/* Achievement Points (NEW) */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-3xl p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">⭐ Achievement Points</p>
              <h2 className="text-6xl font-bold text-emerald-300 tracking-tighter">{countPoints}</h2>
              <p className="text-sm text-emerald-300/70 mt-3">
                +100 per focus session • +75 for no distractions
              </p>
            </div>
            <div className="text-6xl opacity-20">✨</div>
          </div>
        </div>

        {/* Focus Sessions Summary (NEW) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Focus Sessions</p>
            <h3 className="text-4xl font-bold text-white">{stats.focusSessions}</h3>
            <p className="text-xs text-zinc-500 mt-2">All-time sessions</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Total Focus Time</p>
            <h3 className="text-4xl font-bold text-emerald-400">
              {Math.floor(stats.totalFocusTime / 3600)}h {Math.floor((stats.totalFocusTime % 3600) / 60)}m
            </h3>
            <p className="text-xs text-zinc-500 mt-2">Deep work accumulated</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Avg Per Session</p>
            <h3 className="text-4xl font-bold text-white">
              {stats.focusSessions > 0 ? Math.round(stats.totalFocusTime / stats.focusSessions / 60) : 0}m
            </h3>
            <p className="text-xs text-zinc-500 mt-2">Average duration</p>
          </div>
        </div>

        {/* Recent Focus Sessions (NEW) */}
        {focusHistory.length > 0 && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Recent Focus Sessions</h3>
            <div className="space-y-3">
              {focusHistory.map((session, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[#222] rounded-lg border border-white/5">
                  <div>
                    <p className="font-medium text-white">
                      {sanitizeForHTML(session.habit_focused || 'Focus Session')}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {Math.floor(session.duration_seconds / 60)}min
                      {session.completed && ' • ✓ Completed'}
                      {session.pauses > 0 && ` • ${session.pauses} pause${session.pauses > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400">{session.achievement_points}pts</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-8 rounded-3xl space-y-8">
            <h3 className="text-xl font-bold text-white mb-2">Weekly Performance</h3>
            <div className="flex items-end justify-between h-48 gap-4 px-2">
              {weeklyData.map((pct, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-3">
                  <div className="w-full bg-emerald-500/10 rounded-full relative overflow-hidden h-full">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-emerald-500 transition-all duration-1000 ease-out rounded-full"
                      style={{ height: `${Math.max(0, Math.min(100, pct))}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{DAY_LABELS[i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-8 rounded-3xl space-y-8">
            <h3 className="text-xl font-bold text-white mb-2">Last 4 Weeks</h3>
            <div className="grid grid-rows-4 gap-3">
              {streakGrid.map((week, wi) => (
                <div key={wi} className="flex justify-between">
                  {week.map((status, di) => (
                    <div key={di} className={`w-8 h-8 rounded-lg transition-all duration-500 ${dotClass(status)}`} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Coach Insights */}
        <div className="space-y-6 py-6">
          <h3 className="text-xl font-bold text-white">AI Coach Insights</h3>
          {insightsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
              {[1, 2, 3].map(i => (<div key={i} className="h-32 bg-white/5 rounded-2xl" />))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.map((insight, i) => (
                <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] p-6 rounded-2xl space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{insight.icon || '💡'}</span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Growth</span>
                  </div>
                  <h4 className="font-bold text-white">{sanitizeForHTML(insight.title || '')}</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">{sanitizeForHTML(insight.body || '')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}