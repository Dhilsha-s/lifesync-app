/** Rich dark gradient + soft orbs — shared across app surfaces */
export default function PageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-indigo-950/40 to-zinc-950" />
      <div className="absolute -top-40 left-1/2 h-[min(120vw,720px)] w-[min(120vw,720px)] -translate-x-1/2 rounded-full bg-violet-600/25 blur-[120px] md:bg-violet-600/20" />
      <div className="absolute bottom-0 right-0 h-[min(80vw,480px)] w-[min(80vw,480px)] rounded-full bg-fuchsia-600/15 blur-[100px]" />
      <div className="absolute bottom-1/4 left-0 h-64 w-64 rounded-full bg-indigo-600/20 blur-[90px] md:h-96 md:w-96" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(124,58,237,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(79,70,229,0.12),transparent)]" />
    </div>
  );
}
