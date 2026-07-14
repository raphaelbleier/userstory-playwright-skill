import { test, expect } from '@playwright/test';

test('US-003: Anonymous visitor cannot reach the dashboard', {
  tag: '@US-003',
  annotation: { type: 'story', description: 'US-003' },
}, async ({ page }) => {
  // Given: I am not logged in
  // (fresh context, no session cookie)

  // When: I navigate to /dashboard
  await page.goto('/dashboard');

  // Then: I am redirected to /login
  await expect(page).toHaveURL('/login');
});
