import { useState } from 'react';
import Analytics from './pages/Analytics';
import Dashboard from './pages/Dashboard';
import FocusTimer from './pages/FocusTimer';
import GoalPlanner from './pages/GoalPlanner';
import Onboarding from './pages/Onboarding';
import SplashScreen from './components/SplashScreen';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState('onboarding');
  const [userName, setUserName] = useState('');
  const [planMilestones, setPlanMilestones] = useState(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [planDeadline, setPlanDeadline] = useState('');

  if (showSplash) {
    return <SplashScreen onFinished={() => setShowSplash(false)} />;
  }

  const onNavigate = (tab) => {
    if (tab === 'home') setScreen('dashboard');
    else if (tab === 'goals') setScreen('goalPlanner');
    else if (tab === 'focus') setScreen('focusTimer');
    else if (tab === 'analytics') setScreen('analytics');
  };

  if (screen === 'onboarding') {
    return (
      <div className="animate-page-enter min-h-screen">
        <Onboarding
          onComplete={({ name, bigGoal, deadline, milestones }) => {
            setUserName(name);
            setGoalTitle(bigGoal || '');
            setPlanDeadline(deadline || '');
            setPlanMilestones(milestones);
            setScreen('goalPlanner');
          }}
        />
      </div>
    );
  }

  let page = null;
  if (screen === 'analytics') {
    page = <Analytics onNavigate={onNavigate} />;
  } else if (screen === 'focusTimer') {
    page = <FocusTimer onNavigate={onNavigate} />;
  } else if (screen === 'goalPlanner') {
    page = (
      <GoalPlanner
        onNavigate={onNavigate}
        initialMilestones={planMilestones}
        goalTitle={goalTitle}
        deadline={planDeadline}
      />
    );
  } else if (screen === 'dashboard') {
    page = <Dashboard name={userName} onNavigate={onNavigate} />;
  }

  return (
    <div key={screen} className="animate-page-enter min-h-screen">
      {page}
    </div>
  );
}

export default App;
