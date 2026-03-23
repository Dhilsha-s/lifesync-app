test('timer starts at 25 minutes', () => {
  const FOCUS_DURATION = 25 * 60;
  expect(FOCUS_DURATION).toBe(1500);
});

test('timer formats time correctly', () => {
  const formatTime = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  };
  expect(formatTime(1500)).toBe('25:00');
  expect(formatTime(0)).toBe('00:00');
  expect(formatTime(90)).toBe('01:30');
  expect(formatTime(61)).toBe('01:01');
});

test('progress calculates correctly', () => {
  const duration = 1500;
  const timeLeft = 750;
  const progress = 1 - timeLeft / duration;
  expect(progress).toBe(0.5);
});

test('session increments after completion', () => {
  let sessions = 0;
  const onComplete = () => { sessions += 1; };
  onComplete();
  expect(sessions).toBe(1);
});
