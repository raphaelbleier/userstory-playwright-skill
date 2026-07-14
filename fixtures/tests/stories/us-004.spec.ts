import { test, expect } from '@playwright/test';

// This story fails against the demo app. That is the point: the app has a planted bug
// (its email validation only checks for a non-empty string). CI asserts that the skill
// catches exactly this one.
test('US-004: Contact form rejects an invalid email address', {
  tag: '@US-004',
  annotation: { type: 'story', description: 'US-004' },
}, async ({ page }) => {
  // Given: I am on /contact
  await page.goto('/contact');

  // When: I submit "notanemail" as my email address
  await page.getByLabel('Email').fill('notanemail');
  await page.getByLabel('Message').fill('Do you ship to Austria?');
  await page.getByRole('button', { name: 'Send message' }).click();

  // Then: the form is rejected and I see "Please enter a valid email address."
  await expect(page.getByRole('alert')).toHaveText('Please enter a valid email address.');
});
