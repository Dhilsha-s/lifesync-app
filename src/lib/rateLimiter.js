/**
 * Sliding-window rate limiter (in-memory, client-side).
 *
 * Tracks timestamps of recent actions and rejects new ones once
 * the limit is reached within the time window.
 *
 * @param {number} maxRequests - Maximum allowed requests in the window (default 10).
 * @param {number} windowMs   - Window duration in milliseconds (default 60 000 = 1 min).
 */
export function createRateLimiter(maxRequests = 10, windowMs = 60_000) {
  const timestamps = [];

  return {
    /**
     * Check whether a new request is allowed.
     * If allowed, the request is recorded automatically.
     *
     * @returns {{ allowed: boolean, retryAfterMs: number }}
     */
    checkLimit() {
      const now = Date.now();

      // Remove expired entries
      while (timestamps.length > 0 && timestamps[0] <= now - windowMs) {
        timestamps.shift();
      }

      if (timestamps.length >= maxRequests) {
        const oldestValid = timestamps[0];
        const retryAfterMs = oldestValid + windowMs - now;
        return { allowed: false, retryAfterMs };
      }

      timestamps.push(now);
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}
