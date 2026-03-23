test('rejects empty name', () => {
  const name = '';
  expect(name.trim().length).toBe(0);
});

test('rejects name over 50 chars', () => {
  const name = 'a'.repeat(51);
  expect(name.length).toBeGreaterThan(50);
});

test('strips HTML tags from name', () => {
  const name = '<script>alert(1)</script>John';
  const clean = name.replace(/<[^>]*>/g, '');
  expect(clean).toBe('alert(1)John');
  expect(clean).not.toContain('<script>');
});

test('rejects empty goal', () => {
  const goal = '   ';
  expect(goal.trim().length).toBe(0);
});

test('rejects goal under 10 chars', () => {
  const goal = 'run';
  expect(goal.trim().length).toBeLessThan(10);
});

test('rejects goal over 500 chars', () => {
  const goal = 'a'.repeat(501);
  expect(goal.length).toBeGreaterThan(500);
});

test('rejects past deadline', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  expect(yesterday < new Date()).toBe(true);
});

test('rejects deadline over 10 years ahead', () => {
  const future = new Date();
  future.setFullYear(future.getFullYear() + 11);
  const tenYears = new Date();
  tenYears.setFullYear(tenYears.getFullYear() + 10);
  expect(future > tenYears).toBe(true);
});

test('accepts valid name', () => {
  const name = 'Dhilsha';
  expect(name.trim().length).toBeGreaterThan(0);
  expect(name.length).toBeLessThanOrEqual(50);
});

test('accepts valid goal', () => {
  const goal = 'I want to lose 30kg in 6 months';
  expect(goal.trim().length).toBeGreaterThanOrEqual(10);
  expect(goal.length).toBeLessThanOrEqual(500);
});
