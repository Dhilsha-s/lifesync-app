/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      boxShadow: {
        glass:
          '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glass-sm':
          '0 4px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)',
        'glow-violet': '0 0 28px rgba(139, 92, 246, 0.35)',
        'btn-primary':
          '0 4px 24px rgba(124, 58, 237, 0.35), 0 1px 0 rgba(255,255,255,0.08) inset',
      },
      keyframes: {
        'page-enter': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.85' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'page-enter': 'page-enter 0.4s ease-out forwards',
        rise: 'rise 0.55s ease-out forwards',
        'spin-slow': 'spin-slow 1.1s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
