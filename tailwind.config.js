/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['frontend/**/*.html','frontend/src/**/*.{js,ts,html}'],
  theme: {
    extend: {
      colors: {
        verde: {
          principal: '#26A653', // verde médio principal
          claro: '#38B964', // hover claro
          escuro: '#1E8643', // active / foco
        },
      },
    },
  },
  plugins: [],
}
