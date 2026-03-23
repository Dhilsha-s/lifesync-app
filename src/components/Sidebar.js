import { NAV_TABS } from './navData';

export default function Sidebar({ activeTab = 'home', onSelect }) {
  return (
    <aside
      className="fixed left-0 top-0 z-40 hidden h-screen w-[min(17rem,22vw)] min-w-[15rem] flex-col border-r border-border bg-surface py-8 md:flex"
      aria-label="Main navigation"
    >
      <div className="px-6 pb-8 flex items-center gap-3">
        <div className="w-[34px] h-[34px] rounded-lg bg-lime flex items-center justify-center">
          <svg className="w-5 h-5 text-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-bold tracking-tight text-white">
            LifeSync
          </p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-2 px-4">
        {NAV_TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect?.(id)}
              className={`group flex min-h-[44px] items-center gap-3 rounded-xl px-4 text-left text-sm transition-all duration-150 focus:outline-none ${
                active
                  ? 'bg-lime text-bg font-bold'
                  : 'text-text-muted hover:bg-[#1c1c1c] hover:text-white font-medium'
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
                <Icon />
              </span>
              {label}
            </button>
          );
        })}
      </nav>

      {/* Sign Out Button */}
      <div className="mt-auto px-4 pt-4">
        <button
          onClick={() => {
            localStorage.removeItem('lifesync_uid');
            window.location.reload();
          }}
          className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-4 text-left text-sm font-medium text-text-muted transition-all duration-150 hover:bg-[rgba(255,77,77,0.1)] hover:text-[#ff4d4d] focus:outline-none"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
