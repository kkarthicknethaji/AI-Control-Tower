import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#102a6b', navy2: '#071a43', purple: '#5e2dcc', purple2: '#7c4dff', purpleP: '#f0ebff',
        blue: '#1769d1', blueP: '#e7f0ff', green: '#04756f', greenP: '#e5f7f2', amber: '#b86d05', amberP: '#fff2d8',
        red: '#b42318', redP: '#fee8e6', ink: '#101828', text: '#344054', muted: '#667085', faint: '#98a2b3',
        bg: '#eef2f8', card: '#ffffff', line: '#d9e0ec', soft: '#f7f9fc',
      },
      boxShadow: {
        card: '0 18px 55px rgba(16,24,40,.10)',
        soft: '0 8px 22px rgba(16,24,40,.08)',
        hover: '0 12px 28px rgba(16,24,40,.09)',
      },
      borderRadius: { card: '18px', control: '12px', pill: '999px' },
      fontFamily: { sans: ['Aptos', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
