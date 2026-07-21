import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1B7A4D',
          dark:    '#0F5235',
          mid:     '#2EA06A',
          light:   '#E6F5EE',
        },
        surface: {
          0: '#F4F4F2',
          1: '#FAFAF8',
          2: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
