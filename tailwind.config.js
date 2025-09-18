/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./themes/sheet2site-theme/layouts/**/*.html",
    "./content/**/*.md"
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}