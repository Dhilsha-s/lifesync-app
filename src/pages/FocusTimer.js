import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { sanitizeForHTML } from '../lib/validation';
import AppShell from '../components/AppShell';

const QUOTES = [
  "Do the hard work, especially when you don't feel like it. — Seth Godin",
  "The only way to do great work is to love what you do. — Steve Jobs",
  "Focus is the gateway to success. — Unknown",
  "Your focus determines your reality. — George Lucas",
  "Concentration is the secret of strength. — Ralph Waldo Emerson",
];

const AMBIENT_SOUNDS = [
  { name: '🌧️ Rain', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { name: '☕ Cafe', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { name: '🌲 Forest', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
];

const ACHIEVEMENT_POINTS = {
  complete: 100,     // Completed 25min session
  breakRecord: 50,   // Beat personal best
  streak: 25,        // Consecutive sessions
  noDistraction: 75, // No pauses during session
};

const MODES = [
  { id: 'pomodoro', name: 'Focus', time: 25 * 60, color: '#C8F135' },
  { id: 'shortBreak', name: 'Short Break', time: 5 * 60, color: '#FFE500' },
  { id: 'longBreak', name: 'Long Break', time: 15 * 60, color: '#FF3CAC' }
];

export default function FocusTimer({ onNavigate, userId, goalTitle = '' }) {
  // Timer state
  const [mode, setMode] = useState('pomodoro');
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pauseCount, setPauseCount] = useState(0);
  const timerRef = useRef(null);

  // Focus session state
  const [currentTask, setCurrentTask] = useState('');
  const [habits, setHabits] = useState([]);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [sessionStats, setSessionStats] = useState({
    sessionsToday: 0,
    totalFocusTime: 0,
    bestStreak: 0,
    currentStreak: 0,
  });

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedSound, setSelectedSound] = useState(null);
  const soundRef = useRef(null);
  const [motivationalMessage, setMotivationalMessage] = useState('');
  const [showStats, setShowStats] = useState(true);
  const [completedHabits, setCompletedHabits] = useState({});

  // Get today's date
  const formatLocalYYYYMMDD = (date) => {
    const d = new Date(date);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };
  const todayStr = formatLocalYYYYMMDD(new Date());

  // 🎯 Fetch habits for today
  useEffect(() => {
    async function fetchHabits() {
      if (!userId) return;
      try {
        const { data } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', userId)
          .eq('date', todayStr);

        if (data) {
          setHabits(data);
          // Pre-populate completed habits
          const completed = {};
          data.forEach(h => {
            if (h.completed) completed[h.habit_name] = true;
          });
          setCompletedHabits(completed);
        }
      } catch (err) {
        console.error('FocusTimer: Failed to fetch habits', err);
      }
    }
    fetchHabits();
  }, [userId, todayStr]);

  // 📊 Fetch session stats
  useEffect(() => {
    async function fetchSessionStats() {
      if (!userId) return;
      try {
        const { data } = await supabase
          .from('focus_sessions')
          .select('*')
          .eq('user_id', userId)
          .gte('session_date', todayStr);

        if (data) {
          const sessionsToday = data.length;
          const totalSeconds = data.reduce((sum, s) => sum + s.duration_seconds, 0);
          setSessionStats(prev => ({
            ...prev,
            sessionsToday,
            totalFocusTime: totalSeconds,
          }));
        }
      } catch (err) {
        console.error('FocusTimer: Failed to fetch session stats', err);
      }
    }
    fetchSessionStats();
  }, [userId, todayStr]);

  // 💾 Save focus session to Supabase
  const saveFocusSession = useCallback(async (completed = false) => {
    if (!userId || !sessionStartTime) return;

    try {
      const durationSeconds = elapsedSeconds;
      const noPauses = pauseCount === 0;
      let achievementPoints = 0;

      if (completed) {
        achievementPoints += ACHIEVEMENT_POINTS.complete;
        if (noPauses) achievementPoints += ACHIEVEMENT_POINTS.noDistraction;
      }

      const { error } = await supabase.from('focus_sessions').insert({
        user_id: userId,
        session_date: todayStr,
        duration_seconds: durationSeconds,
        habit_focused: selectedHabit || currentTask || 'General Focus',
        completed,
        pauses: pauseCount,
        achievement_points: achievementPoints,
      });

      if (error) throw error;

      setSessionStats(prev => ({
        ...prev,
        sessionsToday: prev.sessionsToday + 1,
        totalFocusTime: prev.totalFocusTime + durationSeconds,
      }));
    } catch (err) {
      console.error('FocusTimer: Failed to save session', err);
    }
  }, [userId, sessionStartTime, elapsedSeconds, pauseCount, todayStr, selectedHabit, currentTask]);

  // ⏱️ Timer logic
  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          saveFocusSession(true);
          return 25 * 60;
        }
        setElapsedSeconds(prev => prev + 1);
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [isRunning, userId, saveFocusSession]);

  // 🎵 Ambient sound toggle
  useEffect(() => {
    if (!soundRef.current) return;

    if (!selectedSound) {
      if (soundRef.current) soundRef.current.pause();
      return;
    }

    soundRef.current.src = selectedSound.url;
    soundRef.current.loop = true;
    soundRef.current.volume = 0.3;
    if (soundRef.current) soundRef.current.play().catch(err => console.log('Audio play failed:', err));

    const audio = soundRef.current;
    return () => {
      if (audio) audio.pause();
    };
  }, [selectedSound]);

  // 🎬 Rotate motivational messages
  useEffect(() => {
    const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    setMotivationalMessage(randomQuote);

    const interval = setInterval(() => {
      const newQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      setMotivationalMessage(newQuote);
    }, 15000); // Change every 15 seconds

    return () => clearInterval(interval);
  }, []);

  // ⏸️ Pause timer
  const handlePause = () => {
    setIsRunning(false);
    setPauseCount(prev => prev + 1);
  };

  // ▶️ Resume timer
  const handleStart = () => {
    if (!sessionStartTime) {
      setSessionStartTime(new Date());
    }
    setIsRunning(true);
  };

  // 🔄 Handle mode change
  const handleModeChange = (newMode) => {
    if (isRunning) {
      if (!window.confirm('Switching modes will reset your current timer. Continue?')) return;
    }
    const modeData = MODES.find(m => m.id === newMode);
    if (modeData) {
      setMode(newMode);
      setTimeLeft(modeData.time);
      setIsRunning(false);
      setElapsedSeconds(0);
      setPauseCount(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // 🔄 Reset timer
  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const modeData = MODES.find(m => m.id === mode);
    setTimeLeft(modeData ? modeData.time : 25 * 60);
    setIsRunning(false);
    setElapsedSeconds(0);
    setPauseCount(0);
    setSessionStartTime(null);
    setCurrentTask('');
    setSelectedHabit(null);
  };


  // ✅ Complete habit
  const toggleHabit = async (habitName) => {
    const isCompleted = completedHabits[habitName];
    setCompletedHabits(prev => ({
      ...prev,
      [habitName]: !isCompleted,
    }));

    try {
      const habit = habits.find(h => h.habit_name === habitName);
      if (habit) {
        await supabase
          .from('habits')
          .update({ completed: !isCompleted })
          .eq('id', habit.id);
      }
    } catch (err) {
      console.error('FocusTimer: Failed to update habit', err);
    }
  };

  // 🖱️ Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const currentModeData = MODES.find(m => m.id === mode);
  const totalSessionTime = currentModeData ? currentModeData.time : 25 * 60;
  const progressPercent = (elapsedSeconds / totalSessionTime) * 100;
  const activeColor = currentModeData ? currentModeData.color : '#C8F135';

  // ✨ Fullscreen Timer View
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-[#0a0a0a] font-sans">
        {/* Close fullscreen */}
        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-6 right-6 text-[#555555] hover:text-[#ffffff] text-2xl"
        >
          ✕
        </button>

        {/* Mode Switcher */}
        <div className="mb-8 p-1 bg-[#111111] border border-[#1f1f1f] rounded-[14px] flex gap-1">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              className={`px-6 py-2 rounded-[10px] text-[13px] font-[700] transition-all ${
                mode === m.id 
                  ? `bg-[${m.color}] text-[#0a0a0a]` 
                  : 'text-[#555555] hover:text-[#ffffff]'
              }`}
              style={mode === m.id ? { backgroundColor: m.color } : {}}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* Current Task */}
        {currentTask && (
          <div className="text-center mb-8">
            <p className="text-[#888888] text-[12px] font-[600] uppercase tracking-[0.8px] mb-2">FOCUSING ON</p>
            <h2 className="text-[32px] font-[800] text-[#ffffff] tracking-[-0.6px]">
              {sanitizeForHTML(currentTask)}
            </h2>
          </div>
        )}

        {/* Big Timer */}
        <div className="relative w-[340px] h-[340px] flex items-center justify-center bg-[#111111] border border-[#1f1f1f] rounded-[20px] p-[40px]">
          <svg className="absolute w-[260px] h-[260px] -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="#1f1f1f" strokeWidth="8" />
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke={activeColor}
              strokeWidth="8"
              strokeDasharray={`${(progressPercent / 100) * 565} 565`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s linear' }}
            />
          </svg>
          <div className="text-center z-10 flex flex-col items-center mt-2">
            <div className="text-[72px] font-[900] text-[#ffffff] tracking-[-3px] mb-[2px] leading-none">
              {formatTime(timeLeft)}
            </div>
            <div className="text-[14px] font-[600] text-[#444444] uppercase tracking-[1px]">
              {mode === 'pomodoro' ? 'FOCUSING' : 'BREAK'}
            </div>
          </div>
        </div>

        {/* Countdown message */}
        <div className="text-center max-w-md mt-10 mb-8 border-l-[2px] pl-4 inline-block" style={{ borderColor: activeColor }}>
          <p className="text-[15px] font-[400] text-[#444444] italic">
             {sanitizeForHTML(motivationalMessage)}
          </p>
          <p className="text-[12px] font-[600] text-[#555555] tracking-[1px] uppercase mt-4">
            {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')} elapsed
          </p>
        </div>

        {/* Controls */}
        <div className="flex gap-4">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="font-[800] text-[15px] rounded-[14px] p-[14px_32px] border-none min-h-[54px] uppercase tracking-wide"
              style={{ backgroundColor: activeColor, color: '#0a0a0a' }}
            >
              START
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="bg-[#1f1f1f] text-[#ffffff] border border-[#2a2a2a] rounded-[14px] p-[14px_24px] min-h-[54px] font-[800] text-[15px] uppercase tracking-wide"
            >
              PAUSE
            </button>
          )}
          <button
            onClick={handleReset}
            className="bg-[#111111] text-[#555555] border border-[#1f1f1f] rounded-[14px] p-[14px_24px] min-h-[54px] font-[800] text-[15px] hover:text-[#ffffff] uppercase tracking-wide"
          >
            RESET
          </button>
        </div>

        {/* No distractions message */}
        <div className="text-center text-[12px] font-[600] mt-6 tracking-wide" style={{ color: activeColor }}>
          {pauseCount === 0 ? '✓ Zero distractions — stay focused!' : `⚠ ${pauseCount} pause${pauseCount > 1 ? 's' : ''}`}
        </div>
        <audio ref={soundRef} src="" preload="none" />
      </div>
    );
  }

  // 📱 Main Focus Timer View
  return (
    <AppShell activeTab="focus" onNavigate={onNavigate}>
      <div className="bg-[#0a0a0a] min-h-screen px-[16px] py-[20px] md:px-[28px] md:py-[24px] font-sans">
        <div className="space-y-8 max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-[800] text-[#ffffff] tracking-[-0.6px] mb-[2px]">Focus Session</h1>
              <p className="text-[13px] text-[#444444]">Deep work timer with progress tracking</p>
            </div>
            
            {/* Mode Switcher */}
            <div className="p-1 bg-[#111111] border border-[#1f1f1f] rounded-[14px] flex gap-1 self-start md:self-auto">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleModeChange(m.id)}
                  className={`px-4 py-2 rounded-[10px] text-[12px] font-[700] transition-all ${
                    mode === m.id 
                      ? `bg-[${m.color}] text-[#0a0a0a]` 
                      : 'text-[#555555] hover:text-[#ffffff]'
                  }`}
                  style={mode === m.id ? { backgroundColor: m.color } : {}}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Current Task Selection */}
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-[14px] p-6">
            <label className="block text-[12px] font-[600] text-[#888888] uppercase tracking-[0.8px] mb-3">
              What are you focusing on?
            </label>
            <input
              type="text"
              value={currentTask}
              onChange={(e) => setCurrentTask(e.target.value)}
              placeholder="e.g., Deep work on project"
              disabled={isRunning}
              className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-[10px] text-[#ffffff] text-[15px] px-[16px] py-[12px] outline-none focus:border-[#C8F135] disabled:opacity-50"
            />
            {selectedHabit && (
              <div className="mt-4 p-[12px] bg-[#1a1c11] border border-[#303814] rounded-[10px]">
                <p className="text-[13px] font-[500] text-[#C8F135]">
                  📌 Linked to: {sanitizeForHTML(selectedHabit)}
                </p>
              </div>
            )}
          </div>

          {/* Session Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-[14px] p-[14px_16px]">
              <p className="text-[#444444] text-[10px] font-[600] uppercase tracking-[0.8px] mb-[6px]">Sessions Today</p>
              <h3 className="text-[26px] font-[900] text-[#C8F135] tracking-[-0.5px]">{sessionStats.sessionsToday}</h3>
            </div>
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-[14px] p-[14px_16px]">
              <p className="text-[#444444] text-[10px] font-[600] uppercase tracking-[0.8px] mb-[6px]">Total Focus Time</p>
              <h3 className="text-[26px] font-[900] text-[#FFE500] tracking-[-0.5px]">
                {Math.floor(sessionStats.totalFocusTime / 60)}m
              </h3>
            </div>
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-[14px] p-[14px_16px]">
              <p className="text-[#444444] text-[10px] font-[600] uppercase tracking-[0.8px] mb-[6px]">Elapsed</p>
              <h3 className="text-[26px] font-[900] text-[#ffffff] tracking-[-0.5px]">
                {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
              </h3>
            </div>
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-[14px] p-[14px_16px]">
              <p className="text-[#444444] text-[10px] font-[600] uppercase tracking-[0.8px] mb-[6px]">Pauses</p>
              <h3 className="text-[26px] font-[900] text-[#FF3CAC] tracking-[-0.5px]">{pauseCount}</h3>
            </div>
          </div>

          {/* Timer Area */}
          <div className="flex flex-col items-center gap-8 py-4">
            {/* Motivational message */}
            <div className="w-full flex justify-center">
              <p className="text-[13px] text-[#444444] italic text-center max-w-sm border-l-[2px] py-1 pl-[12px]" style={{ borderColor: activeColor }}>
                 {sanitizeForHTML(motivationalMessage)}
              </p>
            </div>

            {/* Timer */}
            <div className="relative w-[300px] h-[300px] bg-[#111111] border border-[#1f1f1f] rounded-[20px] p-[40px] flex items-center justify-center">
              <svg className="absolute w-[220px] h-[220px] -rotate-90" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="90" fill="none" stroke="#1f1f1f" strokeWidth="8" />
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke={activeColor}
                  strokeWidth="8"
                  strokeDasharray={`${(progressPercent / 100) * 565} 565`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s linear' }}
                />
              </svg>
              <div className="text-center z-10 flex flex-col items-center mt-2">
                <div className="text-[56px] font-[900] text-[#ffffff] tracking-[-3px] leading-none mb-1">
                  {formatTime(timeLeft)}
                </div>
                <div className="text-[12px] font-[600] text-[#444444] uppercase tracking-[1px]">
                  {Math.floor(progressPercent)}%
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  className="font-[800] text-[15px] rounded-[14px] p-[14px_32px] border-none min-h-[54px] uppercase tracking-wide hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: activeColor, color: '#0a0a0a' }}
                >
                  START
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="bg-[#1f1f1f] text-[#ffffff] border border-[#2a2a2a] rounded-[14px] p-[14px_24px] min-h-[54px] font-[800] text-[15px] uppercase tracking-wide hover:bg-[#2a2a2a] transition-colors"
                >
                  PAUSE
                </button>
              )}
              <button
                onClick={handleReset}
                className="bg-[#111111] text-[#555555] border border-[#1f1f1f] rounded-[14px] p-[14px_24px] min-h-[54px] font-[800] text-[15px] hover:text-[#ffffff] uppercase tracking-wide transition-colors"
              >
                RESET
              </button>
              <button
                onClick={() => setIsFullscreen(true)}
                className="bg-[#111111] text-[#555555] border border-[#1f1f1f] rounded-[14px] p-[14px_20px] min-h-[54px] font-[800] text-[15px] hover:text-[#ffffff] transition-colors"
                title="Fullscreen mode"
              >
                ⛶
              </button>
            </div>

            {/* Distraction Counter */}
            <div className="text-center text-[12px] font-[600] mt-2" style={{ color: activeColor }}>
              {pauseCount === 0 ? '✓ Zero distractions — stay focused!' : `⚠ ${pauseCount} pause${pauseCount > 1 ? 's' : ''}`}
            </div>
          </div>

          {/* Ambient Sounds */}
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-[16px] p-[20px]">
            <label className="block text-[12px] font-[600] text-[#888888] uppercase tracking-[0.8px] mb-[16px]">
              🎵 Ambient Sounds
            </label>
            <div className="flex flex-wrap gap-3">
              {AMBIENT_SOUNDS.map(sound => {
                const isActive = selectedSound?.name === sound.name;
                return (
                  <button
                    key={sound.name}
                    onClick={() => setSelectedSound(isActive ? null : sound)}
                    className={`min-h-[44px] rounded-[99px] p-[8px_16px] text-[13px] font-[500] border transition-all ${
                      isActive
                        ? 'bg-[#C8F135] border-[#C8F135] text-[#0a0a0a] font-[700]'
                        : 'bg-[#0a0a0a] border-[#1f1f1f] text-[#555555] hover:border-[#444444] hover:text-[#ffffff]'
                    }`}
                    style={isActive ? { backgroundColor: '#C8F135', borderColor: '#C8F135' } : {}}
                  >
                    {sound.name}
                  </button>
                );
              })}
              {selectedSound && (
                <button
                  onClick={() => setSelectedSound(null)}
                  className="min-h-[44px] bg-[#0a0a0a] border border-[#1f1f1f] rounded-[99px] p-[8px_16px] text-[13px] font-[500] text-[#555555] hover:border-[#ff4d4d] hover:text-[#ff4d4d] transition-colors"
                >
                  ✕ Off
                </button>
              )}
            </div>
          </div>

          {/* Today's Habits Checklist */}
          {habits.length > 0 && (
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-[16px] p-[20px]">
              <label className="block text-[12px] font-[600] text-[#888888] uppercase tracking-[0.8px] mb-[16px]">
                📋 Today's Habits (Quick Complete)
              </label>
              <div className="space-y-3">
                {habits.map(habit => {
                  const done = completedHabits[habit.habit_name];
                  return (
                    <button
                      key={habit.id}
                      onClick={() => {
                        toggleHabit(habit.habit_name);
                        setSelectedHabit(habit.habit_name);
                      }}
                      className={`w-full flex items-center gap-[14px] p-[16px] rounded-[12px] border transition-all text-left ${
                        done
                          ? 'bg-[#1a1c11] border-[#303814]'
                          : 'bg-[#0a0a0a] border-[#1f1f1f] hover:border-[#2a2a2a]'
                      }`}
                    >
                      <div
                        className={`w-[22px] h-[22px] rounded border-[2px] flex items-center justify-center shrink-0 ${
                          done
                            ? 'bg-[#C8F135] border-[#C8F135]'
                            : 'border-[#444444]'
                        }`}
                        style={done ? { backgroundColor: '#C8F135', borderColor: '#C8F135' } : {}}
                      >
                        {done && (
                          <svg className="w-[14px] h-[14px] text-[#0a0a0a]" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                          </svg>
                        )}
                      </div>
                      <span
                        className={`font-[500] text-[15px] ${
                          done
                            ? 'text-[#555555] line-through'
                            : 'text-[#ffffff]'
                        }`}
                      >
                        {sanitizeForHTML(habit.habit_name)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note about achievements */}
          <div className="bg-[#1a1c11] border border-[#303814] rounded-[12px] p-[16px] text-[13px] text-[#C8F135] font-[500]">
            <span className="opacity-80">💡 <strong>Achievement Points:</strong> Complete sessions (+100pts), no pauses (+75pts), streak bonuses in Analytics!</span>
          </div>
          <audio ref={soundRef} src="" preload="none" />
        </div>
      </div>
    </AppShell>
  );
}