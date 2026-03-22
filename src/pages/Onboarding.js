import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createRateLimiter } from '../lib/rateLimiter';
import { validateName, validateGoal, validateDeadline, NAME_MAX, GOAL_MAX } from '../lib/validation';

// Single rate limiter instance shared across submissions (10 requests / 60 s)
const submitLimiter = createRateLimiter(10, 60_000);

function parseMilestonesJson(content) {
  if (!content || typeof content !== 'string') throw new Error('Invalid reply from AI.');
  let trimmed = content.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) trimmed = fence[1].trim();
  const parsed = JSON.parse(trimmed);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('AI reply was not a JSON object.');
  const toStr = (v) => (typeof v === 'string' ? v : v != null ? String(v) : '');
  if (!['year','month','week','day'].every((k) => Object.prototype.hasOwnProperty.call(parsed, k)))
    throw new Error('AI reply must include year, month, week, and day keys.');
  return { year: toStr(parsed.year), month: toStr(parsed.month), week: toStr(parsed.week), day: toStr(parsed.day) };
}

function MagneticButton({ children, type = 'button', disabled, onClick, className }) {
  const ref = useRef(null);
  const handleMouseMove = (e) => {
    const btn = ref.current;
    if (!btn || disabled) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px) scale(1.03)`;
  };
  const handleMouseLeave = () => {
    if (ref.current) ref.current.style.transform = 'translate(0,0) scale(1)';
  };
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`transition-all duration-200 ease-out text-black ${className}`}
    >
      {children}
    </button>
  );
}

export default function Onboarding({ onComplete }) {
  const [name, setName] = useState('');
  const [bigGoal, setBigGoal] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [spotlight, setSpotlight] = useState({ x: -999, y: -999 });

  useEffect(() => {
    const move = (e) => setSpotlight({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // --- Input validation (runs before any network call) ---
    const nameCheck = validateName(name);
    if (!nameCheck.valid) { setError(nameCheck.message); return; }

    const goalCheck = validateGoal(bigGoal);
    if (!goalCheck.valid) { setError(goalCheck.message); return; }

    const deadlineCheck = validateDeadline(deadline);
    if (!deadlineCheck.valid) { setError(deadlineCheck.message); return; }

    // --- Rate limiting ---
    const { allowed, retryAfterMs } = submitLimiter.checkLimit();
    if (!allowed) {
      const secs = Math.ceil(retryAfterMs / 1000);
      setError(`Too many requests. Please wait ${secs} second${secs !== 1 ? 's' : ''} and try again.`);
      return;
    }

    setLoading(true);

    // Sanitise inputs
    const safeName = name.trim().slice(0, NAME_MAX);
    const safeGoal = bigGoal.trim().slice(0, GOAL_MAX);
    const safeDeadline = deadline.trim();
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.REACT_APP_GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{
            role: 'user',
            content: `You are a productivity coach. Name: ${safeName}, Goal: ${safeGoal}, Deadline: ${safeDeadline}. Return ONLY a JSON object with keys: year, month, week, day. Each value is a short milestone string.`,
          }],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || `Request failed (${response.status}).`);
      const text = payload?.choices?.[0]?.message?.content;
      const milestones = parseMilestonesJson(text);

      // --- Save to Supabase ---
      // 1. Insert user into "users" table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert([{ name: safeName, goal: safeGoal, deadline: safeDeadline }])
        .select()
        .single();

      if (userError) throw new Error(`Failed to save user: ${userError.message}`);

      // 2. Insert milestones into "milestones" table
      const { error: milestoneError } = await supabase
        .from('milestones')
        .insert({
          user_id: userData.id,
          year_milestone: milestones.year,
          month_milestone: milestones.month,
          week_milestone: milestones.week,
          day_milestone: milestones.day,
        });

      if (milestoneError) throw new Error(`Failed to save milestones: ${milestoneError.message}`);

      onComplete?.({ name: safeName, bigGoal: safeGoal, deadline: safeDeadline, milestones });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-zinc-100" style={{ background: '#0a0a0f' }}>

      {/* Spotlight */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(700px circle at ${spotlight.x}px ${spotlight.y}px, rgba(16,185,129,0.08), transparent 70%)`,
        }}
      />

      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #6ee7b7, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-10 lg:py-20">
        <div className="grid flex-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">

          {/* Left — Branding */}
          <header style={{ animation: 'riseUp 0.6s ease forwards', opacity: 0 }}
            className="text-center lg:text-left">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400 tracking-widest uppercase">
              ✦ AI-Powered Planning
            </div>
            <h1
              className="text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
              style={{ textShadow: '0 0 40px rgba(16,185,129,0.5), 0 0 80px rgba(16,185,129,0.2)' }}
            >
              LifeSync
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-zinc-400 sm:text-xl lg:max-w-md">
              Turn your goals into daily action — with a plan that adapts to your deadline.
            </p>

            {/* Feature pills */}
            <div className="mt-8 hidden flex-wrap gap-3 lg:flex">
              {['AI Goal Breakdown', 'Daily Tasks', 'Focus Timer', 'Analytics'].map((f, i) => (
                <span
                  key={f}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400"
                  style={{ animation: `riseUp 0.5s ${i * 80 + 400}ms ease forwards`, opacity: 0 }}
                >
                  {f}
                </span>
              ))}
            </div>
          </header>

          {/* Right — Form */}
          <div style={{ animation: 'riseUp 0.6s 0.15s ease forwards', opacity: 0 }}>
            <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl sm:p-8 lg:p-10"
              style={{ boxShadow: '0 0 60px rgba(16,185,129,0.08), 0 25px 50px rgba(0,0,0,0.5)' }}>

              {/* Loading overlay */}
              {loading && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 rounded-2xl bg-black/70 backdrop-blur-md">
                  <div className="relative h-16 w-16">
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-400"
                      style={{ boxShadow: '0 0 20px rgba(16,185,129,0.4)' }} />
                  </div>
                  <p className="text-sm font-semibold text-emerald-300">AI is building your plan...</p>
                </div>
              )}

              {error && (
                <div className="mb-5 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name */}
                <div style={{ animation: 'riseUp 0.5s 0.2s ease forwards', opacity: 0 }}>
                  <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    maxLength={NAME_MAX}
                    required
                    disabled={loading}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all duration-200 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
                  />
                </div>

                {/* Big Goal */}
                <div style={{ animation: 'riseUp 0.5s 0.3s ease forwards', opacity: 0 }}>
                  <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Big Goal</label>
                  <textarea
                    rows={4}
                    value={bigGoal}
                    onChange={(e) => setBigGoal(e.target.value)}
                    placeholder="What do you want to achieve?"
                    maxLength={GOAL_MAX}
                    required
                    disabled={loading}
                    className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all duration-200 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
                  />
                </div>

                {/* Deadline */}
                <div style={{ animation: 'riseUp 0.5s 0.4s ease forwards', opacity: 0 }}>
                  <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50 [color-scheme:dark]"
                  />
                </div>

                {/* Submit */}
                <div style={{ animation: 'riseUp 0.5s 0.5s ease forwards', opacity: 0 }}>
                  <MagneticButton
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl py-3.5 text-sm font-bold text-black disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #6ee7b7, #10b981)',
                      boxShadow: '0 0 30px rgba(16,185,129,0.4)',
                    }}
                  >
                    {loading ? 'Generating...' : '✦ Generate My Plan'}
                  </MagneticButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes riseUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}