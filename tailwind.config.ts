import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#121826",
        panelBorder: "#263148",
        accent: "#6366f1",
      },
      boxShadow: {
        premium: "0 24px 50px rgba(4, 9, 24, 0.5)",
      },
    },
  },
  plugins: [],
} satisfies Config;
