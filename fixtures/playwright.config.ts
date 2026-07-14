import { defineConfig, devices } from '@playwright/test';

// Config for the demo fixture. The real one that `init` installs is templates/playwright.config.ts.
const baseURL = process.env.BASE_URL ?? 'http://localhost:3100';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node demo-app/server.mjs',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
