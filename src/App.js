import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Analytics from './pages/Analytics';
import Dashboard from './pages/Dashboard';
import FocusTimer from './pages/FocusTimer';
import GoalPlanner from './pages/GoalPlanner';
import Onboarding from './pages/Onboarding';
import SplashScreen from './components/SplashScreen';
import HabitSetup from './pages/HabitSetup';
import HabitTracker from './pages/HabitTracker';
function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState('onboarding');
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [planMilestones, setPlanMilestones] = useState(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [planDeadline, setPlanDeadline] = useState('');
  const [initialGeneratedHabits, setInitialGeneratedHabits] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const GROQ_KEY = process.env.REACT_APP_GROQ_KEY || '';

  useEffect(() => {
    async function initApp() {
      const storedUid = localStorage.getItem('lifesync_uid');
      if (!storedUid) {
        setIsInitializing(false);
        return;
      }

      try {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', storedUid)
          .single();

        if (userError || !user) throw userError || new Error("User not found");

        const { data: milestones } = await supabase
          .from('milestones')
          .select('*')
          .eq('user_id', storedUid)
          .single();

        setUserId(user.id);
        setUserName(user.name);
        setGoalTitle(user.goal || '');
        setPlanDeadline(user.deadline || '');
        if (milestones) {
          setPlanMilestones({
             year: milestones.year_milestone,
             month: milestones.month_milestone,
             week: milestones.week_milestone,
             day: milestones.day_milestone
          });
        }
        setScreen('dashboard');
      } catch (err) {
        console.error("Failed to restore session", err);
        localStorage.removeItem('lifesync_uid');
        setScreen('onboarding');
      } finally {
        setIsInitializing(false);
      }
    }
    initApp();
  }, []);

  if (showSplash) {
    return <SplashScreen onFinished={() => setShowSplash(false)} />;
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col justify-center items-center">
        <div className="w-10 h-10 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-emerald-500/80 text-sm font-medium tracking-wide animate-pulse">Syncing LifeSync...</p>
      </div>
    );
  }

  const onNavigate = (tab) => {
    if (tab === 'home') setScreen('dashboard');
    else if (tab === 'goals') setScreen('goalPlanner');
    else if (tab === 'habits') setScreen('habits');
    else if (tab === 'focus') setScreen('focusTimer');
    else if (tab === 'analytics') setScreen('analytics');
  };

  if (screen === 'onboarding') {
    return (
      <Onboarding
        onComplete={({ name, bigGoal, deadline, milestones, userId: newUserId }) => {
          setUserId(newUserId);
          setUserName(name);
          setGoalTitle(bigGoal || '');
          setPlanDeadline(deadline || '');
          setPlanMilestones(milestones);
          setScreen('habitSetup');
        }}
      />
    );
  } else if (screen === 'analytics') {
    return <Analytics onNavigate={onNavigate} userId={userId} groqKey={GROQ_KEY} />;
  } else if (screen === 'focusTimer') {
    return <FocusTimer onNavigate={onNavigate} />;
  } else if (screen === 'goalPlanner') {
    return (
      <GoalPlanner
        onNavigate={onNavigate}
        initialMilestones={planMilestones}
        goalTitle={goalTitle}
        deadline={planDeadline}
        userId={userId}
        groqKey={GROQ_KEY}
      />
    );
  } else if (screen === 'habitSetup') {
    return (
      <HabitSetup 
        goalTitle={goalTitle} 
        onComplete={(habits) => {
          setInitialGeneratedHabits(habits);
          setScreen('habits');
        }}
      />
    );
  } else if (screen === 'habits') {
    return (
      <HabitTracker 
        onNavigate={onNavigate} 
        goalTitle={goalTitle} 
        userId={userId} 
        initialGeneratedHabits={initialGeneratedHabits}
        groqKey={GROQ_KEY}
        deadline={planDeadline}
      />
    );
  } else if (screen === 'dashboard') {
    return <Dashboard name={userName} onNavigate={onNavigate} userId={userId} />;
  }

  return null;
}


export default App;
