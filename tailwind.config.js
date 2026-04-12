/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Surface system
        surface: {
          base:     '#06090E',
          raised:   '#0C1118',
          elevated: '#111B27',
          overlay:  '#172030',
        },
        // Border system
        border: {
          subtle:  '#111D2C',
          default: '#1A2D40',
          bright:  '#274359',
          focus:   '#3B82F6',
        },
        // EV signal colors
        ev: {
          strong:  '#00FF9D',
          good:    '#10E890',
          lean:    '#34D399',
          neutral: '#64748B',
          fade:    '#F43F5E',
          skip:    '#475569',
        },
        // Brand blue
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Semantic
        positive: '#10B981',
        negative: '#EF4444',
        warning:  '#F59E0B',
        stale:    '#FB923C',
        // Keep legacy dark for compat
        dark: {
          100: '#111B27',
          200: '#0C1118',
          300: '#06090E',
          400: '#03060A',
        }
      },
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':      'fadeIn 0.2s ease-out',
        'slide-up':     'slideUp 0.25s ease-out',
        'slide-right':  'slideRight 0.3s ease-out',
        'glow-pulse':   'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideRight:{ '0%': { transform: 'translateX(-8px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0,255,157,0.2)' },
          '50%':      { boxShadow: '0 0 20px rgba(0,255,157,0.5)' },
        },
      },
      boxShadow: {
        'ev':      '0 0 16px rgba(0, 255, 157, 0.15)',
        'ev-lg':   '0 0 32px rgba(0, 255, 157, 0.25)',
        'card':    '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(26,45,64,0.6)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(42,67,89,0.8)',
      },
    },
  },
  plugins: [],
}
