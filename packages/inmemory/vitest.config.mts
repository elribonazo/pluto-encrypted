/// <reference types="vitest" />
import { defineConfig } from 'vite'

const isCI = process.env.CI === "true";

export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: { format: { comments: 'all' } },
  },
  test: {
    reporters: ['verbose'], // or 'verbose'
    coverage: {
      provider: 'istanbul',
      reporter: isCI ? ['json-summary'] : ['json-summary', "html"],
      thresholds: {
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50
      },
      include: [
        'src/**/*',
      ],
    },

  }
})
