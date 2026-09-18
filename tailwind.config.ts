import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: 'rgba(20, 20, 26, 0.72)',
        stroke: 'rgba(255, 255, 255, 0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        float: '0 8px 32px rgba(0, 0, 0, 0.45)',
      },
      backdropBlur: {
        panel: '18px',
      },
    },
  },
  plugins: [],
} satisfies Config
