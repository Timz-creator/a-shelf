module.exports = {
  content: [
    "'./pages/**/*.{js,ts,jsx,tsx,mdx}'",
    "'./components/**/*.{js,ts,jsx,tsx,mdx}'",
    "'./app/**/*.{js,ts,jsx,tsx,mdx}'",
  ],
  theme: {
    extend: {
      colors: {
        "'apple-bg'": "'#f5f5f7'",
        "'apple-text'": "'#1d1d1f'",
        "'apple-secondary'": "'#86868b'",
        "'apple-green'": "'#06c149'",
      },
    },
  },
  plugins: [],
}

