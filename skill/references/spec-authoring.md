# Story -> Playwright spec

One story, one spec file: `tests/stories/us-001.spec.ts`.

## The template

```ts
import { test, expect } from '@playwright/test';

test('US-001: Visitor can register with a valid email', {
  tag: '@US-001',
  annotation: { type: 'story', description: 'US-001' },
}, async ({ page }) => {
  // Given: I am on /register
  await page.goto('/register');

  // When: I submit a valid email and a password of 8+ characters
  await page.getByLabel('Email').fill('new.user@example.com');
  await page.getByLabel('Password').fill('correct-horse-1');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Then: I am redirected to /dashboard and see my email in the header
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('banner')).toContainText('new.user@example.com');
});
```

Non-negotiable:

- **Title starts with the story ID.** `US-001: <story title>`.
- **`tag: '@US-001'`** — this is what `--grep @US-001` filters on.
- **`annotation: { type: 'story', description: 'US-001' }`** — this is what `xlsx-sync` reads out
  of the JSON report. Without it the result cannot be joined back to the sheet.
- **Given/When/Then as comments**, mapped 1:1 to the acceptance criteria in the sheet. When the
  spec and the sheet drift apart, these comments are how anyone notices.

No Cucumber. No `.feature` files. No step definitions. The comments carry the BDD structure; a
BDD framework would cost you the native Playwright runner and buy nothing here.

## Selectors

Priority order — go down the list only when the one above is genuinely unavailable:

1. `getByRole('button', { name: 'Create account' })` — how a user and a screen reader find it
2. `getByLabel('Email')` — for form fields
3. `getByText('Welcome back')` — for content
4. `getByTestId('cart-badge')` — if the app already has test IDs
5. CSS/XPath — last resort, and leave a comment saying why

Never select on a generated class name (`.css-1x2y3z`), a Tailwind utility chain, or DOM position
(`div > div:nth-child(3)`). Those break on the next styling change and produce failures that look
like bugs but aren't — exactly the noise triage exists to eliminate, so don't create it.

## Auto-waiting

Playwright's assertions retry. Use them.

```ts
await expect(page.getByRole('alert')).toHaveText('Saved');   // retries until it matches or times out
```

Never do this:

```ts
await page.waitForTimeout(2000);   // flake generator
```

A fixed sleep is either too short (flaky failure) or too long (slow suite). It is never right.
If you genuinely need to wait for something non-visual, wait for the thing itself:
`page.waitForURL()`, `page.waitForResponse()`, or an assertion on the resulting DOM state.

## Auth

Stories with `Requires Auth = yes` need the authenticated project. The config ships two projects:

```ts
// playwright.config.ts (installed by init)
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: '.auth/storageState.json' },
    dependencies: ['setup'],
  },
]
```

`auth.setup.ts` logs in once with the credentials from `.env` and saves the storage state. Every
authenticated spec then starts already logged in — no login steps inside individual specs.

For an explicitly anonymous story ("as a visitor, I cannot reach /admin"), opt out of the stored
state in that one spec:

```ts
test.use({ storageState: { cookies: [], origins: [] } });
```

## Test data

Each spec must be able to run twice in a row and on a shared environment. That means:

- Unique values per run where the app enforces uniqueness:
  `` const email = `user-${Date.now()}@example.com` ``
- Clean up what you create, or create it in a way that does not collide.
- Never depend on data another spec created. Specs run in parallel and in arbitrary order.

## Credentials

Read from `process.env`. Never hardcode. Never write a real credential into the sheet, a story,
or a spec.

```ts
const email = process.env.TEST_USER_EMAIL!;
```

## When the story is not testable yet

If the story needs a flow you cannot reach (no test account, a payment provider, an email link),
do not write a spec that fakes a pass. Skip it explicitly, with the reason:

```ts
test.skip('US-014: User completes checkout with a credit card', {
  tag: '@US-014',
  annotation: { type: 'story', description: 'US-014' },
}, async () => {
  // needs a Stripe test-mode key in .env (STRIPE_TEST_KEY)
});
```

It lands in the sheet as `skipped`, which is honest, and the sheet shows exactly what is blocking
it. A fake pass is worse than no test.
