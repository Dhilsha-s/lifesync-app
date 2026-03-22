import { NAV_TABS } from './navData';

export default function Sidebar({ activeTab = 'home', onSelect }) {
  return (
    <aside
      className="fixed left-0 top-0 z-40 hidden h-screen w-[min(17rem,22vw)] min-w-[15rem] flex-col border-r border-white/[0.08] bg-zinc-950/55 py-8 backdrop-blur-2xl md:flex"
      aria-label="Main navigation"
    >
      <div className="px-6 pb-8">
        <p className="text-lg font-bold tracking-tight text-white drop-shadow-[0_0_18px_rgba(167,139,250,0.45)]">
          LifeSync
        </p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-zinc-500">
          Goals → daily action
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect?.(id)}
              className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${
                active
                  ? 'bg-gradient-to-r from-violet-600/25 to-purple-600/15 text-violet-200 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.25),0_0_24px_rgba(124,58,237,0.2)]'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100 hover:shadow-[0_0_20px_rgba(124,58,237,0.12)]'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-300 [&>svg]:h-5 [&>svg]:w-5 ${
                  active
                    ? 'border-violet-400/40 bg-violet-500/20 text-violet-200 shadow-[0_0_16px_rgba(139,92,246,0.35)]'
                    : 'border-white/5 bg-white/[0.03] text-zinc-500 group-hover:border-violet-500/30 group-hover:text-violet-300 group-hover:shadow-[0_0_14px_rgba(124,58,237,0.2)]'
                }`}
              >
                <Icon />
              </span>
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
