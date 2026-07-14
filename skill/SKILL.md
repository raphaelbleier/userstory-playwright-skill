---
name: user-story-testing
description: Derive user stories from a website codebase into an Excel sheet, turn them into Playwright E2E tests, run them, and write failures and their root causes back into the sheet. Use when asked to generate user stories, build an E2E test suite from a codebase, run a QA pass over a website, or track bugs against user stories.
license: MIT
---

# User Story Testing

Three operations over one Excel file. The sheet is the source of truth — the user owns it and
may edit, reorder, delete and add rows freely. Never regenerate it from scratch once it exists.

| Operation | What it does |
|---|---|
| **generate** | Read the codebase, derive user stories, write `user-stories.xlsx` |
| **run** | Turn stories into Playwright specs, execute them, write results into the sheet |
| **triage** | Inspect each failure, decide what actually broke, record severity and root cause |

If the user says "test my site" without specifying, do all three in order.

## Setup (once per repo)

If `playwright.config.ts` is absent, the install did not complete. Tell the user to run
`npx userstory-playwright-skill init` and stop.

Install browsers if `npx playwright test --list` fails with a missing-browser error:

```bash
npx playwright install --with-deps chromium
```

---

## generate

**Read `references/story-generation.md` before starting.**

1. Map the app's surface from the code. Routes/pages, forms, auth flows, navigation, primary
   actions. Framework-agnostic: Next/React/Vue/Svelte routers, Django/Rails/Laravel route files,
   Express handlers, plain HTML.

2. **Optional crawl enrichment.** If the user gives you a running `baseURL`, visit the key pages
   and confirm the flows exist and the selectors are real. Skip this if no URL is available —
   static reading is the default, not a degraded mode.

3. **Stop and ask the user before writing anything.** Present:
   - the flows/areas you found, grouped
   - how many stories that would produce
   - which areas you propose to cover, and which to skip

   A mid-sized app yields 80+ stories. That may be exactly what the user wants, or far too much.
   It is their call, not yours. Do not silently cap the number, and do not silently generate
   everything.

4. Write `stories.json`, then:

```bash
node .agents/skills/user-story-testing/scripts/xlsx-init.mjs \
  --stories stories.json --out user-stories.xlsx
```

`stories.json` shape:

```json
{
  "stories": [
    {
      "id": "US-001",
      "title": "Visitor can register with a valid email",
      "role": "visitor",
      "goal": "create an account with my email and a password",
      "benefit": "I can access the dashboard",
      "priority": "Must",
      "acceptanceCriteria": "Given I am on /register\nWhen I submit a valid email and a password of 8+ characters\nThen I am redirected to /dashboard and see my email in the header",
      "preconditions": "no account exists for this email",
      "requiresAuth": false,
      "sourceFiles": "src/app/register/page.tsx, src/lib/auth.ts"
    }
  ]
}
```

IDs are `US-001`, `US-002`, … and are the join key for everything downstream. Never renumber an
existing story. New stories continue from the highest existing ID.

`xlsx-init` refuses to overwrite an existing sheet. That is deliberate. To add stories to a sheet
that already exists, read it first (`xlsx-read.mjs`), append to the array, and re-init with
`--force`.

---

## run

**Read `references/spec-authoring.md` before writing specs.**

1. **Ask the user for the `baseURL`**, and for the command that starts the app if it is not
   already running. Do not guess it from `package.json`. Write both into `.env`
   (see `.env.example`).

2. If any story has `Requires Auth = yes`, make sure `.env` has test credentials and that
   `tests/auth.setup.ts` matches the app's real login form.

3. Read the current sheet:

```bash
node .agents/skills/user-story-testing/scripts/xlsx-read.mjs \
  --xlsx user-stories.xlsx --status not-run,fail
```

4. Write one spec per story into `tests/stories/`. Every spec carries the story ID twice:

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

The tag drives `--grep`. The annotation is what the sync script reads. Both are required.

5. Run:

```bash
npx playwright test --reporter=json > test-results/results.json || true
```

The `|| true` matters — Playwright exits non-zero when tests fail, which is the normal case here,
and you still need the report.

6. Sync:

```bash
node .agents/skills/user-story-testing/scripts/xlsx-sync.mjs \
  --xlsx user-stories.xlsx --results test-results/results.json
```

---

## triage

**Read `references/triage.md` before judging any failure.**

A red test is not the same as a bug. For every failing story, open the evidence and decide which
of these it is:

| Verdict | Meaning | What you do |
|---|---|---|
| **real bug** | the app is wrong | record severity + root cause, leave Status `fail` |
| **bad spec** | selector, timing or assumption in *your* test is wrong | fix the spec, re-run that story, do not report a bug |
| **wrong story** | the feature does not work the way the story claims | correct the story text, set Status `blocked` |

Look at the actual evidence, not just the error string:

```bash
npx playwright show-trace test-results/<dir>/trace.zip
```

Then write `triage.json` and sync it:

```json
{
  "triage": [
    {
      "id": "US-007",
      "severity": "S2-Critical",
      "rootCause": "Contact form accepts an email with no @ sign. The client-side check in ContactForm.tsx only tests for a non-empty string, and the server route never re-validates. Invalid addresses are written straight to the leads table.",
      "status": "fail"
    }
  ]
}
```

```bash
node .agents/skills/user-story-testing/scripts/xlsx-sync.mjs \
  --xlsx user-stories.xlsx --triage triage.json
```

Root cause means *cause*, not a restatement of the assertion. "Expected /dashboard, got /login"
is the symptom. "The session cookie is set without a `Path`, so it isn't sent on the redirect" is
the cause. If you cannot determine the cause without guessing, say so in the cell rather than
inventing one.

Severity is about impact, and is independent of the story's Priority:

- `S1-Blocker` — core flow unusable, no workaround
- `S2-Critical` — major function broken or data integrity at risk
- `S3-Major` — feature broken, workaround exists
- `S4-Minor` — cosmetic or edge case
- `S5-Trivial` — nitpick

---

## Rules

- The user owns columns ID..Source Files. Never rewrite them outside `generate`.
- Never delete a row from the sheet. If a story is obsolete, set Status `blocked` and say why.
- Never mark a story `pass` that you did not actually run.
- Secrets live in `.env`, which is gitignored. Never write a credential into a spec, a story, or
  the sheet.
