import { useEffect, useState } from 'react';

/** Animates from 0 to target over duration (ms) with ease-out cubic. */
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let rafId;
    const start = performance.now();

    function tick(now) {
      if (cancelled) return;
      const elapsed = now - start;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - (1 - p) ** 3;
      setValue(Math.round(target * eased));
      if (p < 1) rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [target, duration]);

  return value;
}
