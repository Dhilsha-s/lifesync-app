import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import PageTransition from './PageTransition';

export default function AppShell({ activeTab, onNavigate, children }) {
  const getPageTitle = (id) => {
    const titles = { home: 'Home', goals: 'Goals', habits: 'Habits', focus: 'Focus', analytics: 'Analytics' };
    return titles[id] || 'LifeSync';
  };

  return (
    <div className="relative min-h-screen bg-bg text-text-primary font-sans overflow-x-hidden flex flex-col">
      
      {/* Mobile Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-[58px] bg-bg/80 backdrop-blur-xl border-b border-border z-40 flex items-center justify-between px-4 md:hidden">
        <div className="flex items-center gap-3">
          <div className="w-[30px] h-[30px] rounded-md bg-lime flex items-center justify-center">
            <svg className="w-4 h-4 text-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold">{getPageTitle(activeTab)}</h1>
        </div>
      </header>

      <Sidebar activeTab={activeTab} onSelect={onNavigate} />
      
      <main className="relative z-10 min-h-screen pt-[58px] pb-[64px] md:pt-0 md:pb-0 md:pl-[min(17rem,22vw)]" style={{ flex: 1, overflow: 'auto' }}>
        <PageTransition transitionKey={activeTab}>
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-10 lg:px-10">
            {children}
          </div>
        </PageTransition>
      </main>
      
      <BottomNav activeTab={activeTab} onSelect={onNavigate} />
    </div>
  );
}
