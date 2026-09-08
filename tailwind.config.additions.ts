/**
 * Add / merge this into your existing tailwind.config.ts (or .js).
 * Only the `theme.extend.fontFamily` block is new — everything else
 * in your config should stay as-is.
 */

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // default body text -> DM Sans
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        // headings / wordmark / gig titles -> Syne
        display: ["var(--font-syne)", "system-ui", "sans-serif"],
        // prices, receipt-style numerals -> DM Mono
        mono: ["var(--font-dm-mono)", "monospace"],
      },
      colors: {
        // Optional: register brand tokens as named colors instead of
        // repeating hex arbitrary values everywhere. Safe to skip if
        // you'd rather keep using bg-[#0D0D0D] style arbitrary values.
        ink: "#0D0D0D",
        paper: "#171717",
        "paper-2": "#1D1D1D",
        ember: "#F26419",
        bone: "#F5F2EC",
        slate: "#8C8C8C",
        line: "#2A2A2A",
      },
    },
  },
  plugins: [],
};

export default config;
