import { defineConfig, devices } from '@playwright/test';

// Credentials and the target URL live in .env, never in this file.
// See .env.example. Node 20.6+ / 22+ loads it with --env-file, or use dotenv.
const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL,
    // failures are the point of this suite, so always keep the evidence
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/storageState.json' },
      dependencies: ['setup'],
    },
  ],

  // Uncomment once you know the command that starts your app, and set it in .env.
  // The skill asks you for this rather than guessing it.
  // webServer: {
  //   command: process.env.DEV_COMMAND!,
  //   url: baseURL,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
