/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14283d',
        muted: '#718196',
        canvas: '#f5f8fb',
        brand: { 50: '#eaf8f8', 100: '#d3f0ef', 500: '#10a3a2', 600: '#078b8b', 700: '#087374' },
      },
      fontFamily: { sans: ['DM Sans', 'sans-serif'], display: ['Manrope', 'sans-serif'] },
      boxShadow: { card: '0 12px 40px rgba(31, 57, 78, .055)' },
    },
  },
  plugins: [],
};
