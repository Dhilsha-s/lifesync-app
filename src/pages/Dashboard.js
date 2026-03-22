import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';

const SAMPLE_TASKS = [
  { id: '1', title: 'Review weekly goals' },
  { id: '2', title: '30 min deep work block' },
  { id: '3', title: 'Log progress in journal' },
];

export default function Dashboard({ name = '', onNavigate }) {
  const displayName = name.trim() || 'there';

  const [tasks, setTasks] = useState(() =>
    SAMPLE_TASKS.map((t) => ({ ...t, status: 'open' }))
  );
  const [ringReady, setRingReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setRingReady(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const doneCount = useMemo(
    () => tasks.filter((t) => t.status === 'done').length,
    [tasks]
  );
  const total = tasks.length;
  const completionPct = total ? Math.round((doneCount / total) * 100) : 0;

  const markDone = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'done' } : t))
    );
  };

  const markSkip = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'skipped' } : t))
    );
  };

  const r = 56;
  const c = 2 * Math.PI * r;
  const displayPct = ringReady ? completionPct : 0;
  const offset = c * (1 - displayPct / 100);

  return (
    <AppShell activeTab="home" onNavigate={onNavigate}>
      <div className="space-y-8 sm:space-y-10 lg:space-y-12">
        <header className="animate-rise ls-glass px-5 py-6 opacity-0 shadow-glass [animation-fill-mode:forwards] sm:px-8 sm:py-8">
          <p className="text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl lg:text-3xl">
            Good morning, {displayName}! 👋
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Today&apos;s focus — stay consistent, one task at a time.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div className="flex flex-col items-center justify-center lg:items-start">
            <div className="relative flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52 lg:h-56 lg:w-56">
              <svg
                className="h-full w-full -rotate-90 drop-shadow-[0_0_24px_rgba(124,58,237,0.25)]"
                viewBox="0 0 128 128"
                aria-hidden
              >
                <defs>
                  <linearGradient id="dashRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#c4b5fd" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
                <circle
                  cx="64"
                  cy="64"
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="10"
                />
                <circle
                  cx="64"
                  cy="64"
                  r={r}
                  fill="none"
                  stroke="url(#dashRingGrad)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={offset}
                  className="transition-[stroke-dashoffset] duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold tabular-nums text-white sm:text-5xl">
                  {completionPct}%
                </span>
                <span className="mt-1 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                  done
                </span>
              </div>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.05] px-5 py-2.5 text-sm font-medium text-zinc-200 shadow-glass-sm backdrop-blur-md lg:mt-8">
              <span aria-hidden>🔥</span>
              <span>5 day streak</span>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Today&apos;s tasks
            </h2>
            <ul className="mt-4 space-y-3 sm:space-y-4">
              {tasks.map((task, index) => (
                <li
                  key={task.id}
                  className="animate-rise ls-glass px-4 py-4 opacity-0 sm:px-5 sm:py-5"
                  style={{
                    animationDelay: `${80 + index * 70}ms`,
                    animationFillMode: 'forwards',
                  }}
                >
                  <p
                    className={`text-[15px] font-medium leading-relaxed sm:text-base ${
                      task.status === 'open'
                        ? 'text-zinc-100'
                        : 'text-zinc-500 line-through decoration-zinc-600'
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.status === 'open' ? (
                    <div className="mt-4 flex flex-col gap-2.5 min-[400px]:flex-row">
                      <button
                        type="button"
                        onClick={() => markDone(task.id)}
                        className="ls-btn-primary flex-1 min-h-[2.85rem] text-[15px]"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={() => markSkip(task.id)}
                        className="ls-btn-secondary flex-1 min-h-[2.85rem] text-[15px]"
                      >
                        Skip
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      {task.status === 'done' ? 'Completed' : 'Skipped'}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
