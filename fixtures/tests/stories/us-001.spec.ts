import { test, expect } from '@playwright/test';

test('US-001: Registered user can log in with valid credentials', {
  tag: '@US-001',
  annotation: { type: 'story', description: 'US-001' },
}, async ({ page }) => {
  // Given: I am on /login
  await page.goto('/login');

  // When: I submit my correct email and password
  await page.getByLabel('Email').fill('alice@example.com');
  await page.getByLabel('Password').fill('correct-horse-1');
  await page.getByRole('button', { name: 'Log in' }).click();

  // Then: I am redirected to /dashboard and see "Signed in as alice@example.com"
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText('Signed in as alice@example.com')).toBeVisible();
});
