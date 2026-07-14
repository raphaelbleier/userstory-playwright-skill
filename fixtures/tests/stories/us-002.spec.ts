import { test, expect } from '@playwright/test';

test('US-002: Wrong password is rejected with an error', {
  tag: '@US-002',
  annotation: { type: 'story', description: 'US-002' },
}, async ({ page }) => {
  // Given: I am on /login
  await page.goto('/login');

  // When: I submit a correct email with a wrong password
  await page.getByLabel('Email').fill('alice@example.com');
  await page.getByLabel('Password').fill('definitely-wrong');
  await page.getByRole('button', { name: 'Log in' }).click();

  // Then: I stay on /login and see the alert "Invalid email or password."
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
});
