import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { createRateLimiter } from '../lib/rateLimiter';

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


export default function Onboarding({ onComplete }) {
  const [name, setName] = useState('');
  const [bigGoal, setBigGoal] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});

    const newErrors = {};
    
    // 1. Name validation
    const strippedName = name.replace(/<[^>]*>/g, '').trim();
    if (!strippedName) {
      newErrors.name = "Name is required";
    } else if (strippedName.length > 50) {
      newErrors.name = "Name must be under 50 characters";
    }

    // 2. Goal validation
    const strippedGoal = bigGoal.replace(/<[^>]*>/g, '').trim();
    if (!strippedGoal) {
      newErrors.goal = "Please enter your goal";
    } else if (strippedGoal.length < 10) {
      newErrors.goal = "Please describe your goal in more detail";
    } else if (strippedGoal.length > 500) {
      newErrors.goal = "Goal must be under 500 characters";
    }

    // 3. Deadline validation
    if (!deadline) {
      newErrors.deadline = "Please select a deadline";
    } else {
      const d = new Date(deadline);
      const now = new Date();
      now.setHours(0,0,0,0); // compare at date level
      if (d <= now) {
        newErrors.deadline = "Deadline must be in the future";
      } else {
        const tenYears = new Date();
        tenYears.setFullYear(tenYears.getFullYear() + 10);
        if (d > tenYears) {
          newErrors.deadline = "Please set a realistic deadline";
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // --- Rate limiting ---
    const { allowed, retryAfterMs } = submitLimiter.checkLimit();
    if (!allowed) {
      const secs = Math.ceil(retryAfterMs / 1000);
      setErrors({ form: `Too many requests. Please wait ${secs} second${secs !== 1 ? 's' : ''} and try again.` });
      return;
    }

    setLoading(true);

    const safeName = strippedName;
    const safeGoal = strippedGoal;
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
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert([{ name: safeName, goal: safeGoal, deadline: safeDeadline }])
        .select()
        .single();

      if (userError) throw new Error(`Failed to save user: ${userError.message}`);

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

      localStorage.setItem('lifesync_uid', userData.id);
      onComplete?.({ name: safeName, bigGoal: safeGoal, deadline: safeDeadline, milestones, userId: userData.id });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div 
      className="min-h-screen bg-[#0a0a0a] flex flex-col md:grid md:grid-cols-[55%_45%] md:items-center px-[20px] py-[24px] md:pl-[80px] md:pr-[48px]"
      style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}
    >
      {/* Left side */}
      <header className="flex flex-col mb-10 md:mb-0" style={{ animation: 'riseUp 0.6s ease forwards', opacity: 0 }}>
        <div className="mb-4 inline-flex items-center self-start rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1.5 text-[11px] font-[600] text-[#C8F135] tracking-[1px] uppercase">
          ✦ AI-Powered Planning
        </div>
        <h1 className="text-[40px] md:text-[64px] font-[900] text-[#ffffff] tracking-[-2px] leading-tight">
          LifeSync
        </h1>
        <p className="mt-4 text-[15px] md:text-[18px] font-[400] text-[#444444] max-w-md">
          Turn your goals into daily action — with a plan that adapts to your deadline.
        </p>

        <div className="mt-8 hidden flex-wrap gap-2 lg:flex">
          {['AI Goal Breakdown', 'Daily Tasks', 'Focus Timer', 'Analytics'].map((f, i) => (
            <span
              key={f}
              className="rounded-full border border-[#1f1f1f] bg-[#141414] px-[14px] py-[6px] text-[12px] text-[#555555]"
              style={{ animation: `riseUp 0.5s ${i * 80 + 400}ms ease forwards`, opacity: 0 }}
            >
              {f}
            </span>
          ))}
        </div>
      </header>

      {/* Right side */}
      <div style={{ animation: 'riseUp 0.6s 0.15s ease forwards', opacity: 0 }} className="w-full max-w-[500px] mx-auto md:max-w-none">
        <div className="rounded-[16px] md:rounded-[20px] border border-[#1f1f1f] bg-[#111111] p-[24px] md:p-[32px]">
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Name */}
            <div style={{ animation: 'riseUp 0.5s 0.2s ease forwards', opacity: 0 }}>
              <label className="mb-[8px] block text-[12px] font-[600] text-[#888888] uppercase tracking-[0.8px]">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={loading}
                className={`w-full rounded-[12px] border ${errors.name ? 'border-[#ff4d4d]' : 'border-[#1f1f1f]'} bg-[#0a0a0a] p-[14px_16px] text-[15px] text-[#ffffff] outline-none transition-colors focus:border-[#C8F135] disabled:opacity-50`}
              />
              {errors.name && (
                <p className="text-[#ff4d4d] text-[12px] mt-1.5 ml-1">{errors.name}</p>
              )}
            </div>

            {/* Big Goal */}
            <div style={{ animation: 'riseUp 0.5s 0.3s ease forwards', opacity: 0 }}>
              <label className="mb-[8px] block text-[12px] font-[600] text-[#888888] uppercase tracking-[0.8px]">
                Big Goal
              </label>
              <textarea
                value={bigGoal}
                onChange={(e) => setBigGoal(e.target.value)}
                placeholder="What do you want to achieve?"
                disabled={loading}
                className={`w-full h-[110px] resize-none rounded-[12px] border ${errors.goal ? 'border-[#ff4d4d]' : 'border-[#1f1f1f]'} bg-[#0a0a0a] p-[14px_16px] text-[15px] text-[#ffffff] outline-none transition-colors focus:border-[#C8F135] disabled:opacity-50`}
              />
              {errors.goal && (
                <p className="text-[#ff4d4d] text-[12px] mt-1.5 ml-1">{errors.goal}</p>
              )}
            </div>

            {/* Deadline */}
            <div style={{ animation: 'riseUp 0.5s 0.4s ease forwards', opacity: 0 }}>
              <label className="mb-[8px] block text-[12px] font-[600] text-[#888888] uppercase tracking-[0.8px]">
                Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={loading}
                className={`w-full rounded-[12px] border ${errors.deadline ? 'border-[#ff4d4d]' : 'border-[#1f1f1f]'} bg-[#0a0a0a] p-[14px_16px] text-[15px] text-[#ffffff] outline-none transition-colors focus:border-[#C8F135] disabled:opacity-50 [color-scheme:dark]`}
              />
              {errors.deadline && (
                <p className="text-[#ff4d4d] text-[12px] mt-1.5 ml-1">{errors.deadline}</p>
              )}
            </div>

            {/* Form Error Message */}
            {errors.form && (
              <div className="text-center text-[#ff4d4d] text-[13px] mt-[8px]">
                {errors.form}
              </div>
            )}

            {/* Submit */}
            <div style={{ animation: 'riseUp 0.5s 0.5s ease forwards', opacity: 0 }}>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[54px] rounded-[14px] font-[800] text-[15px] transition-colors flex items-center justify-center gap-2"
                style={{
                  background: loading ? '#1a1a1a' : '#C8F135',
                  color: loading ? '#444444' : '#0a0a0a',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  border: 'none',
                }}
              >
                {loading ? (
                  <>
                    <div className="w-[18px] h-[18px] rounded-full border-[2px] border-[#333333] border-t-[#666666] animate-spin" />
                    Generating your plan…
                  </>
                ) : (
                  '✦ Generate My Plan'
                )}
              </button>
            </div>
          </form>
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