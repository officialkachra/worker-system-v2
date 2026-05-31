import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a1410", paper: "#faf6ef", saffron: "#c1440e",
        gold: "#b8860b", brand: { green: "#1d6b4f", red: "#9e2b2b", amber: "#9a6700" },
      },
      fontFamily: { serif: ["Georgia", "serif"] },
    },
  },
  plugins: [],
};
export default config;
