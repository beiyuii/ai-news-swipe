/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neon-pink': '#ff006e',
        'neon-purple': '#8338ec',
        'dark-bg': '#0a0a0f',
        'card-bg': '#14141e',
      }
    },
  },
  plugins: [],
}
