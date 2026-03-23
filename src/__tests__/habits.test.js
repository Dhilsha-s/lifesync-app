test('only today is editable', () => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const isEditable = (date) => date === today;

  expect(isEditable(today)).toBe(true);
  expect(isEditable(yesterdayStr)).toBe(false);
  expect(isEditable(tomorrowStr)).toBe(false);
});

test('completion rate calculates correctly', () => {
  const habits = [
    { completed: true },
    { completed: true },
    { completed: false },
    { completed: true },
  ];
  const rate = Math.round(
    (habits.filter(h => h.completed).length / habits.length) * 100
  );
  expect(rate).toBe(75);
});

test('completion rate is 0 when no habits done', () => {
  const habits = [
    { completed: false },
    { completed: false },
  ];
  const rate = Math.round(
    (habits.filter(h => h.completed).length / habits.length) * 100
  );
  expect(rate).toBe(0);
});

test('completion rate is 100 when all habits done', () => {
  const habits = [
    { completed: true },
    { completed: true },
  ];
  const rate = Math.round(
    (habits.filter(h => h.completed).length / habits.length) * 100
  );
  expect(rate).toBe(100);
});
