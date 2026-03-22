import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import { useCountUp } from '../hooks/useCountUp';

const STATS = { totalTasksDone: 142, currentStreak: 5, bestStreak: 28 };
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKLY_COMPLETION = [85, 72, 100, 60, 90, 45, 88];
const STREAK_WEEKS = [
  ['completed','missed','completed','completed','completed','missed','completed'],
  ['completed','completed','missed','completed','completed','completed','missed'],
  ['missed','completed','completed','completed','missed','completed','completed'],
  ['completed','completed','completed','missed','future','future','future'],
];
const AI_INSIGHTS = [
  { title: 'Weekend dip', icon: '📉', body: 'Your completion rate drops sharply on Sat–Sun. Try scheduling one small "maintenance" task on weekend mornings so the streak doesn\'t break.' },
  { title: 'Planning vs. doing', icon: '⚡', body: 'Time in Goal Planner is up, but daily task completion is down 12% vs. last week. Shift 15 minutes from planning into one execution block.' },
  { title: 'Upcoming deadline', icon: '🎯', body: 'Your big goal deadline is getting closer. A weekly review on Fridays would reduce last-minute gaps and protect your current streak.' },
];

function dotClass(status) {
  if (status === 'completed') return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
  if (status === 'missed') return 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]';
  return 'bg-zinc-700';
}

export default function Analytics({ onNavigate }) {
  const maxBar = Math.max(...WEEKLY_COMPLETION, 1);
  const countTotal   = useCountUp(STATS.totalTasksDone, 1000);
  const countCurrent = useCountUp(STATS.currentStreak, 900);
  const countBest    = useCountUp(STATS.bestStreak, 1100);
  const [spotlight, setSpotlight] = useState({ x: -999, y: -999 });
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    const move = (e) => setSpotlight({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setBarsReady(true), 300);
    return () => clearTimeout(id);
  }, []);

  return (
    <AppShell activeTab="analytics" onNavigate={onNavigate}>
      {/* Spotlight */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: `radial-gradient(600px circle at ${spotlight.x}px ${spotlight.y}px, rgba(16,185,129,0.06), transparent 70%)` }}
      />

      <div className="relative z-10 space-y-6">

        {/* Header */}
        <header
          className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-6 py-6 backdrop-blur-md"
          style={{ animation: 'riseUp 0.5s ease forwards', opacity: 0 }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Analytics</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Your progress</h1>
          <p className="mt-1 text-sm text-zinc-400">Patterns, streaks, and where to adjust next.</p>
        </header>

        {/* Stats row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'Total Tasks Done', value: countTotal, highlight: false },
            { label: 'Current Streak 🔥', value: countCurrent, highlight: true },
            { label: 'Best Streak', value: countBest, highlight: false },
          ].map((s, i) => (
            <div
              key={s.label}
              className="rounded-2xl border backdrop-blur-md p-5 text-center"
              style={{
                animation: `riseUp 0.5s ${i * 80 + 100}ms ease forwards`,
                opacity: 0,
                borderColor: s.highlight ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)',
                background: s.highlight ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                boxShadow: s.highlight ? '0 0 30px rgba(16,185,129,0.1)' : 'none',
              }}
            >
              <p className={`text-4xl font-bold tabular-nums ${s.highlight ? 'text-emerald-300' : 'text-white'}`}>
                {s.value}
              </p>
              <p className={`mt-2 text-xs font-bold uppercase tracking-widest ${s.highlight ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">

          {/* Bar Chart */}
          <div
            className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 backdrop-blur-md sm:p-7"
            style={{ animation: 'riseUp 0.5s 0.3s ease forwards', opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-white">Weekly completion rate</h2>
              <span className="text-xs font-semibold text-emerald-400">This week</span>
            </div>
            <p className="text-xs text-zinc-500 mb-6">By day · % of planned tasks</p>

            <div className="flex h-48 items-end justify-between gap-2">
              {WEEKLY_COMPLETION.map((pct, i) => {
                const h = barsReady ? (pct / maxBar) * 100 : 0;
                return (
                  <div key={DAY_LABELS[i]} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-400">{pct}%</span>
                    <div className="flex h-36 w-full flex-col justify-end">
                      <div
                        className="w-full rounded-t-lg relative overflow-hidden"
                        style={{
                          height: `${h}%`,
                          minHeight: '6px',
                          background: 'linear-gradient(to top, #065f46, #10b981)',
                          boxShadow: '0 0 12px rgba(16,185,129,0.3)',
                          transition: `height 0.8s ${i * 80}ms cubic-bezier(0.34,1.56,0.64,1)`,
                        }}
                      >
                        {/* Shimmer */}
                        <div className="absolute inset-0"
                          style={{
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.15), transparent)',
                            animation: 'shimmer 3s infinite',
                          }} />
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-zinc-500">{DAY_LABELS[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Streak History */}
          <div
            className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 backdrop-blur-md sm:p-7"
            style={{ animation: 'riseUp 0.5s 0.4s ease forwards', opacity: 0 }}
          >
            <h2 className="text-sm font-bold text-white">Streak history</h2>
            <p className="mt-1 text-xs text-zinc-500 mb-4">Last 4 weeks · Mon → Sun</p>

            <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500 mb-5">
              {[
                { color: 'bg-emerald-500', label: 'Done' },
                { color: 'bg-red-500', label: 'Missed' },
                { color: 'bg-zinc-700', label: 'Future' },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${l.color}`} />
                  {l.label}
                </span>
              ))}
            </div>

            <div className="space-y-3">
              {STREAK_WEEKS.map((week, wi) => (
                <div
                  key={wi}
                  className="flex items-center gap-3"
                  style={{ animation: 'riseUp 0.4s ease forwards', animationDelay: `${wi * 80 + 500}ms`, opacity: 0 }}
                >
                  <span className="w-8 shrink-0 text-[10px] font-bold text-zinc-500">W{wi + 1}</span>
                  <div className="flex flex-1 gap-2">
                    {week.map((day, di) => (
                      <span
                        key={di}
                        className={`h-3.5 w-3.5 rounded-full transition-all duration-300 hover:scale-125 ${dotClass(day)}`}
                        title={`Week ${wi + 1} · ${DAY_LABELS[di]} · ${day}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <section className="pb-4">
          <h2 className="text-sm font-bold text-white mb-1">Where you're falling behind</h2>
          <p className="text-xs text-zinc-500 mb-5">AI-powered insights based on your patterns.</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {AI_INSIGHTS.map((item, i) => (
              <div
                key={item.title}
                className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] p-5 backdrop-blur-md transition-all duration-300 hover:border-emerald-500/30 hover:bg-emerald-500/10"
                style={{ animation: 'riseUp 0.5s ease forwards', animationDelay: `${i * 100 + 600}ms`, opacity: 0 }}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-base">
                    {item.icon}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-300">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <style>{`
        @keyframes riseUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%,100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </AppShell>
  );
}