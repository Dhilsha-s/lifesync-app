import { useEffect, useRef, useState } from 'react';
import AppShell from '../components/AppShell';

const DEFAULT_GOAL_TITLE = 'Get placed in a top company';

const INITIAL_ROWS = [
  { id: 'year', level: 'Year', period: '2025', milestone: 'Define target companies and compensation band; map skills gaps vs. top-tier bar (DSA, system design, behavioral).' },
  { id: 'month', level: 'Month', period: 'June 2026', milestone: 'Complete interview prep sprint: 40+ LeetCode mediums, 2 system design deep-dives, and 5 mock behavioral sessions.' },
  { id: 'week', level: 'Week', period: 'Week of Mar 24', milestone: 'Finalize resume & portfolio; schedule 4 recruiter screens; complete one full mock onsite loop.' },
  { id: 'day', level: 'Day', period: 'Today', milestone: 'Apply to 5 curated roles, solve 2 timed problems, and send 2 follow-ups from last week\'s networking.' },
];

const LEVEL_COLORS = {
  Year:  { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300', dot: '#10b981', glow: 'rgba(16,185,129,0.6)' },
  Month: { bg: 'bg-teal-500/15',    border: 'border-teal-500/30',    text: 'text-teal-300',    dot: '#14b8a6', glow: 'rgba(20,184,166,0.6)' },
  Week:  { bg: 'bg-cyan-500/15',    border: 'border-cyan-500/30',    text: 'text-cyan-300',    dot: '#06b6d4', glow: 'rgba(6,182,212,0.6)'  },
  Day:   { bg: 'bg-sky-500/15',     border: 'border-sky-500/30',     text: 'text-sky-300',     dot: '#0ea5e9', glow: 'rgba(14,165,233,0.6)' },
};

function formatDeadlinePeriod(deadline) {
  if (!deadline) return '—';
  try {
    const d = new Date(deadline + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function rowsFromMilestones(m, deadline) {
  return [
    { id: 'year',  level: 'Year',  period: String(new Date().getFullYear()), milestone: m.year  },
    { id: 'month', level: 'Month', period: formatDeadlinePeriod(deadline),   milestone: m.month },
    { id: 'week',  level: 'Week',  period: 'This week',                      milestone: m.week  },
    { id: 'day',   level: 'Day',   period: 'Today',                          milestone: m.day   },
  ];
}

export default function GoalPlanner({ onNavigate, initialMilestones = null, goalTitle = '', deadline = '' }) {
  const [rows, setRows] = useState(() =>
    initialMilestones ? rowsFromMilestones(initialMilestones, deadline) : INITIAL_ROWS
  );
  const [spotlight, setSpotlight] = useState({ x: -999, y: -999 });
  const title = goalTitle.trim() || DEFAULT_GOAL_TITLE;

  useEffect(() => {
    const move = (e) => setSpotlight({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  const updateRow = (id, field, value) =>
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));

  return (
    <AppShell activeTab="goals" onNavigate={onNavigate}>
      {/* Spotlight */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: `radial-gradient(600px circle at ${spotlight.x}px ${spotlight.y}px, rgba(16,185,129,0.06), transparent 70%)` }}
      />

      <div className="relative z-10 space-y-6">

        {/* Header */}
        <header
          className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-6 py-6 backdrop-blur-md"
          style={{ animation: 'riseUp 0.5s ease forwards', opacity: 0, boxShadow: '0 0 40px rgba(16,185,129,0.06)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Goal Planner</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl lg:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Break your goal into year → month → week → day milestones. Edit any cell — your plan stays in sync.
          </p>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1fr_280px]">

          {/* Timeline Table */}
          <div
            className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 backdrop-blur-md sm:p-7"
            style={{ animation: 'riseUp 0.5s 0.1s ease forwards', opacity: 0 }}
          >
            <div className="mb-5 flex items-center justify-between border-b border-white/[0.06] pb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Timeline</span>
              <span className="text-xs font-semibold text-emerald-400">Year → Month → Week → Day</span>
            </div>

            <div className="space-y-4">
              {rows.map((row, i) => {
                const colors = LEVEL_COLORS[row.level];
                return (
                  <div
                    key={row.id}
                    className="flex gap-4"
                    style={{ animation: 'riseUp 0.5s ease forwards', animationDelay: `${i * 100 + 200}ms`, opacity: 0 }}
                  >
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center pt-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: colors.dot, boxShadow: `0 0 10px ${colors.glow}` }}
                      />
                      {i < rows.length - 1 && (
                        <span className="mt-1 block w-px flex-1 min-h-[80px]"
                          style={{ background: `linear-gradient(to bottom, ${colors.dot}60, transparent)` }} />
                      )}
                    </div>

                    {/* Card */}
                    <div className={`flex-1 rounded-xl border ${colors.border} bg-white/[0.02] p-4 transition-all duration-200 hover:bg-white/[0.04]`}>
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <span className={`rounded-lg border ${colors.border} ${colors.bg} px-3 py-1 text-xs font-bold ${colors.text}`}>
                          {row.level}
                        </span>
                        <input
                          type="text"
                          value={row.period}
                          onChange={(e) => updateRow(row.id, 'period', e.target.value)}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 outline-none transition-all focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 w-32"
                        />
                      </div>
                      <textarea
                        value={row.milestone}
                        onChange={(e) => updateRow(row.id, 'milestone', e.target.value)}
                        rows={2}
                        className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none transition-all focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 leading-relaxed"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tips Sidebar */}
          <aside
            className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 backdrop-blur-md sm:p-6"
            style={{ animation: 'riseUp 0.5s 0.3s ease forwards', opacity: 0 }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Quick Tips</p>
            <ul className="space-y-4">
              {[
                'Shorter milestones for "Day" make habits stick.',
                'Align "Month" with a measurable outcome you can review.',
                'Revisit your Week goal every Sunday evening.',
                'Your Day task should take less than 2 hours.',
              ].map((tip, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-sm leading-relaxed text-zinc-400"
                  style={{ animation: 'riseUp 0.4s ease forwards', animationDelay: `${i * 80 + 400}ms`, opacity: 0 }}
                >
                  <span className="text-emerald-400 mt-0.5 shrink-0">→</span>
                  {tip}
                </li>
              ))}
            </ul>

            {/* Progress indicator */}
            <div className="mt-8 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs font-semibold text-emerald-400 mb-2">Plan Status</p>
              <p className="text-xs text-zinc-400">All 4 milestones defined ✓</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: '100%', background: 'linear-gradient(90deg, #6ee7b7, #10b981)', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        @keyframes riseUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </AppShell>
  );
}