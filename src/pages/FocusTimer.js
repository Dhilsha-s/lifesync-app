import { useEffect, useRef, useState } from 'react';
import AppShell from '../components/AppShell';

const DEFAULT_SECONDS = 25 * 60;
const CURRENT_TASK_NAME = '30 min deep work block';
const QUOTES = [
  '"The successful warrior is the average person with laser-like focus." — Bruce Lee',
  '"Focus is the art of knowing what to ignore." — James Clear',
  '"Energy flows where attention goes." — Tony Robbins',
  '"Do the hard work, especially when you don\'t feel like it." — Seth Godin',
];

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function MagneticButton({ children, onClick, disabled, variant = 'secondary', className = '' }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const b = ref.current;
    if (!b || disabled) return;
    const r = b.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.12;
    const y = (e.clientY - r.top - r.height / 2) * 0.12;
    b.style.transform = `translate(${x}px,${y}px) scale(1.04)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = ''; };

  const base = variant === 'primary'
    ? 'text-black font-bold disabled:opacity-40'
    : 'border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 disabled:opacity-40';

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`flex-1 min-h-[3rem] rounded-xl px-6 text-sm font-semibold transition-all duration-200 ${base} ${className}`}
      style={variant === 'primary' ? {
        background: 'linear-gradient(135deg, #6ee7b7, #10b981)',
        boxShadow: disabled ? 'none' : '0 0 24px rgba(16,185,129,0.4)',
      } : {}}
    >
      {children}
    </button>
  );
}

export default function FocusTimer({ onNavigate }) {
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [spotlight, setSpotlight] = useState({ x: -999, y: -999 });
  const [quoteIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [ringReady, setRingReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setRingReady(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const move = (e) => setSpotlight({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) { setIsRunning(false); setComplete(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const progress = DEFAULT_SECONDS > 0 ? remaining / DEFAULT_SECONDS : 0;
  const r = 58;
  const c = 2 * Math.PI * r;
  const offset = ringReady ? c * (1 - progress) : c;

  const pct = Math.round((1 - progress) * 100);

  return (
    <AppShell activeTab="focus" onNavigate={onNavigate}>
      {/* Spotlight */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: `radial-gradient(600px circle at ${spotlight.x}px ${spotlight.y}px, rgba(16,185,129,0.07), transparent 70%)` }}
      />

      <div className="relative z-10 mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <header
          className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-6 py-5 backdrop-blur-md"
          style={{ animation: 'riseUp 0.5s ease forwards', opacity: 0 }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Focus Session</p>
          <p className="mt-1 text-sm text-zinc-500">Current task</p>
          <h1 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{CURRENT_TASK_NAME}</h1>
        </header>

        <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-10">

          {/* Timer Ring */}
          <div
            className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] px-6 py-10 backdrop-blur-md"
            style={{ animation: 'riseUp 0.5s 0.1s ease forwards', opacity: 0 }}
          >
            <div className="relative flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128" aria-hidden>
                <defs>
                  <linearGradient id="focusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6ee7b7" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                {/* Track */}
                <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
                {/* Progress */}
                <circle
                  cx="64" cy="64" r={r}
                  fill="none"
                  stroke="url(#focusGrad)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={offset}
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.7))' }}
                />
                {/* Shimmer dot at tip */}
                {isRunning && (
                  <circle
                    cx="64" cy="6"
                    r="5"
                    fill="#10b981"
                    style={{ filter: 'blur(2px)', opacity: 0.8 }}
                  />
                )}
              </svg>

              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold tabular-nums text-white sm:text-6xl" aria-live="polite">
                  {formatTime(remaining)}
                </span>
                <span className="mt-1 text-xs font-bold uppercase tracking-widest text-zinc-500">
                  {complete ? '🎉 Done' : isRunning ? '▶ Running' : 'Ready'}
                </span>
              </div>
            </div>

            {/* Mini liquid progress bar */}
            <div className="mt-4 w-full max-w-[200px]">
              <div className="flex justify-between text-xs text-zinc-600 mb-1">
                <span>Progress</span>
                <span className="text-emerald-400">{pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full relative overflow-hidden transition-all duration-1000"
                  style={{
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, #6ee7b7, #10b981)',
                    boxShadow: '0 0 8px rgba(16,185,129,0.6)',
                  }}
                >
                  <div className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                      animation: 'shimmer 2s infinite',
                    }} />
                </div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-4">

            {/* Complete / Quote */}
            {complete ? (
              <div
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-8 text-center"
                style={{ animation: 'riseUp 0.4s ease forwards', opacity: 0 }}
              >
                <p className="text-4xl mb-3">🎉</p>
                <p className="text-xl font-bold text-white">Session Complete!</p>
                <p className="mt-2 text-sm text-emerald-300">Great work! Take a short break.</p>
              </div>
            ) : (
              <div
                className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-6 py-6 backdrop-blur-md"
                style={{ animation: 'riseUp 0.5s 0.2s ease forwards', opacity: 0 }}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Quote</p>
                <blockquote className="text-sm leading-relaxed text-zinc-300 italic">
                  {QUOTES[quoteIdx]}
                </blockquote>
              </div>
            )}

            {/* Session stats */}
            <div
              className="grid grid-cols-3 gap-3"
              style={{ animation: 'riseUp 0.5s 0.3s ease forwards', opacity: 0 }}
            >
              {[
                { label: 'Duration', value: '25 min' },
                { label: 'Elapsed', value: formatTime(DEFAULT_SECONDS - remaining) },
                { label: 'Sessions', value: '3' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-center">
                  <p className="text-lg font-bold text-white">{s.value}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div
              className="flex gap-3"
              style={{ animation: 'riseUp 0.5s 0.4s ease forwards', opacity: 0 }}
            >
              <MagneticButton variant="primary" onClick={() => setIsRunning(true)} disabled={complete || remaining <= 0 || isRunning}>
                ▶ Start
              </MagneticButton>
              <MagneticButton onClick={() => setIsRunning(false)} disabled={!isRunning}>
                ⏸ Pause
              </MagneticButton>
              <MagneticButton onClick={() => { setIsRunning(false); setComplete(false); setRemaining(DEFAULT_SECONDS); }}>
                ↺ Reset
              </MagneticButton>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes riseUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }
      `}</style>
    </AppShell>
  );
}