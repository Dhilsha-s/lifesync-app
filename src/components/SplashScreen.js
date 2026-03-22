import { useEffect, useState } from 'react';

/**
 * Splash screen — dark background with a typewriter "LifeSync" animation
 * that fades out after ~1.8 s total.
 */
export default function SplashScreen({ onFinished }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade-out after the typewriter completes (~1.2 s typing + 0.4 s hold)
    const fadeTimer = setTimeout(() => setFadeOut(true), 1600);
    // Remove splash after fade transition ends (0.5 s)
    const doneTimer = setTimeout(() => onFinished?.(), 2100);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinished]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ background: '#0a0a0f' }}
    >
      <h1
        className="splash-title"
        style={{
          fontSize: 'clamp(2.5rem, 8vw, 5rem)',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: '#fff',
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          textShadow: '0 0 40px rgba(16,185,129,0.5), 0 0 80px rgba(16,185,129,0.15)',
          overflow: 'hidden',
          borderRight: '2px solid rgba(16,185,129,0.7)',
          whiteSpace: 'nowrap',
          width: '0',
          animation: 'typewriter 1.2s steps(8) 0.2s forwards, blink-caret 0.6s step-end 4',
        }}
      >
        LifeSync
      </h1>

      <style>{`
        @keyframes typewriter {
          from { width: 0; }
          to   { width: 8ch; }
        }
        @keyframes blink-caret {
          50% { border-color: transparent; }
        }
      `}</style>
    </div>
  );
}
