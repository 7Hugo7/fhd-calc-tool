/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f0f7',
          100: '#cce1ef',
          200: '#99c3df',
          300: '#66a5cf',
          400: '#3387bf',
          500: '#0069af',
          600: '#00548c',
          700: '#003f69',
          800: '#002a46',
          900: '#001523',
        }
      }
    },
  },
  plugins: [],
}
