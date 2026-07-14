import { test as setup, expect } from '@playwright/test';

const STORAGE_STATE = '.auth/storageState.json';

/**
 * Logs in once. Every authenticated spec reuses the saved state instead of
 * logging in again.
 *
 * ADJUST THIS to match your app's actual login form. The selectors below are a
 * starting point, not a guess that will happen to work.
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env. ' +
        'Copy .env.example to .env and fill them in.',
    );
  }

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log ?in|sign ?in/i }).click();

  // Assert the login actually worked. Without this, a failed login silently saves
  // a logged-out storage state and every authenticated story fails for the wrong reason.
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: STORAGE_STATE });
});
