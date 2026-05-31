import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a1410",
        paper: "#faf6ef",
        saffron: "#c1440e",
        "saffron-soft": "#fbeee7",
        gold: "#b8860b",
        "gold-soft": "#fbf3df",
        "gold-bright": "#f5b730",
        crimson: "#a01a1a",
        emerald: "#1d6b4f",
        "emerald-soft": "#e6f2ec",
        brand: { green: "#1d6b4f", red: "#9e2b2b", amber: "#9a6700" },
      },
      fontFamily: { serif: ["Georgia", "serif"] },
      keyframes: {
        "count-up": { "0%": { transform: "translateY(8px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        "trophy-bounce": { "0%,100%": { transform: "translateY(0) rotate(-3deg)" }, "50%": { transform: "translateY(-6px) rotate(3deg)" } },
        "shimmer": { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        "fade-in-up": { "0%": { transform: "translateY(12px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        "pulse-soft": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.7" } },
      },
      animation: {
        "count-up": "count-up 0.4s ease-out",
        "trophy-bounce": "trophy-bounce 2s ease-in-out infinite",
        "shimmer": "shimmer 3s linear infinite",
        "fade-in-up": "fade-in-up 0.5s ease-out backwards",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
