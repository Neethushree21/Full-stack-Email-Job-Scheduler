/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#161A2B",
          50: "#F4F5F8",
          100: "#E4E6ED",
          200: "#C7CBDA",
          300: "#9AA1BC",
          400: "#6B7295",
          500: "#454B6E",
          600: "#2E3350",
          700: "#1F233B",
          800: "#161A2B",
          900: "#0D0F1B",
        },
        paper: "#FAF8F4",
        stamp: {
          DEFAULT: "#B5622A",
          50: "#FBF1E9",
          100: "#F5DFCB",
          200: "#EAC0A0",
          300: "#DE9F72",
          400: "#C97D4C",
          500: "#B5622A",
          600: "#944D20",
          700: "#713A18",
        },
        sea: {
          DEFAULT: "#3D6E68",
          50: "#EAF2F0",
          100: "#CFE3DF",
          500: "#3D6E68",
          600: "#2F5852",
        },
        rust: {
          DEFAULT: "#A63D33",
          50: "#F8E9E7",
          500: "#A63D33",
        },
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(22, 26, 43, 0.06), 0 8px 24px -12px rgba(22, 26, 43, 0.18)",
      },
    },
  },
  plugins: [],
};
