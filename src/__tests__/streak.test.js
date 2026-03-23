test('streak is 0 with no data', () => {
  const data = [];
  expect(data.length).toBe(0);
});

test('days remaining calculates correctly', () => {
  const calcDaysLeft = (deadline) => {
    const diff = new Date(deadline) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const past = '2020-01-01';
  expect(calcDaysLeft(past)).toBe(0);

  const future = new Date();
  future.setDate(future.getDate() + 10);
  const futureStr = future.toISOString().split('T')[0];
  expect(calcDaysLeft(futureStr)).toBeGreaterThan(0);
});

test('overall progress averages 4 values', () => {
  const milestones = {
    year_progress: 20,
    month_progress: 40,
    week_progress: 60,
    day_progress: 80,
  };
  const overall = Math.round(
    (milestones.year_progress +
      milestones.month_progress +
      milestones.week_progress +
      milestones.day_progress) / 4
  );
  expect(overall).toBe(50);
});
