import { NavIcon } from './NavIcon';
import { NAV_TABS } from './navData';

export default function BottomNav({ activeTab = 'home', onSelect }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 h-[64px] border-t border-border bg-bg/80 backdrop-blur-xl md:hidden"
      aria-label="Main"
    >
      <div className="mx-auto flex h-full max-w-lg items-stretch justify-around px-1">
        {NAV_TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect?.(id)}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-all duration-150 focus:outline-none ${
                active ? 'text-lime' : 'text-text-muted hover:text-white'
              }`}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[2px] bg-lime rounded-b-full shadow-[0_2px_8px_var(--lime)]" />
              )}
              <span className="flex h-7 w-7 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
                <NavIcon>
                  <Icon />
                </NavIcon>
              </span>
              <span className="text-[10px] font-medium tracking-wide">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
