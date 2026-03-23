import { NavIcon } from './NavIcon';
import { NAV_TABS } from './navData';

export default function BottomNav({ activeTab = 'home', onSelect }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-zinc-950/75 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-2">
        {NAV_TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect?.(id)}
              className={`flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 transition-all duration-300 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
                active
                  ? 'text-violet-300 shadow-[0_-8px_28px_rgba(124,58,237,0.2)]'
                  : 'text-zinc-500 hover:text-zinc-200 hover:shadow-[0_0_20px_rgba(124,58,237,0.15)]'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 [&>svg]:h-[1.35rem] [&>svg]:w-[1.35rem] ${
                  active
                    ? 'bg-violet-500/25 text-violet-200 shadow-[0_0_16px_rgba(139,92,246,0.4)]'
                    : 'text-zinc-500 group-hover:text-violet-300'
                }`}
              >
                <NavIcon>
                  <Icon />
                </NavIcon>
              </span>
              <span className="text-[10px] font-semibold tracking-wide sm:text-[11px]">
                {label}
              </span>
            </button>
          );
        })}
        {/* Sign Out Button */}
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('lifesync_uid');
            window.location.reload();
          }}
          className="flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 transition-all duration-300 active:scale-[0.96] focus:outline-none text-red-500 hover:text-red-400"
        >
          <span className="flex h-8 w-8 items-center justify-center text-red-500">
            <svg className="w-[1.35rem] h-[1.35rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </span>
          <span className="text-[10px] font-semibold tracking-wide sm:text-[11px]">
            Sign Out
          </span>
        </button>
      </div>
    </nav>
  );
}
