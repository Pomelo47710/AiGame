/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: "#0b1120",
        panel: "#111827",
        accent: "#38bdf8",
        danger: "#fb7185",
        success: "#22c55e"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(56, 189, 248, 0.18), 0 0 32px rgba(56, 189, 248, 0.12)"
      }
    }
  },
  plugins: []
};
