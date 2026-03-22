import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('renders splash screen then onboarding', async () => {
  render(<App />);

  // Splash screen shows first
  expect(screen.getByText('LifeSync')).toBeInTheDocument();

  // After splash fades, onboarding button appears
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /generate my plan/i })).toBeInTheDocument();
  }, { timeout: 3000 });
});
