import BottomNav from './BottomNav';
import PageBackground from './PageBackground';
import Sidebar from './Sidebar';

/**
 * Main app chrome: ambient background, desktop sidebar, mobile bottom nav,
 * responsive main column with safe padding.
 */
export default function AppShell({ activeTab, onNavigate, children }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-zinc-100">
      <PageBackground />
      <Sidebar activeTab={activeTab} onSelect={onNavigate} />
      <main className="relative z-10 min-h-screen pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10 md:pl-[min(17rem,22vw)]">
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10 md:px-8 lg:px-10 lg:pt-12">
          {children}
        </div>
      </main>
      <BottomNav activeTab={activeTab} onSelect={onNavigate} />
    </div>
  );
}
