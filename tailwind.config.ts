import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#ecfdf5", 400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857" },
        ink: { 900: "#070b14", 800: "#0c1322", 700: "#121b2e", 600: "#1c2740", 500: "#2a3753" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
