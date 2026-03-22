export function NavIcon({ children }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center [&>svg]:h-6 [&>svg]:w-6">
      {children}
    </span>
  );
}
