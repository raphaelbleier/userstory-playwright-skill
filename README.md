# userstory-playwright-skill

Point your coding agent at a website codebase. It writes the user stories into an Excel sheet,
turns each one into a Playwright test, runs them, and writes back what broke — with a real root
cause, a severity, and a link to the trace.

Works with **Claude Code, OpenAI Codex CLI, Kilo Code, OpenCode and GitHub Copilot CLI** from one
install.

```bash
npx userstory-playwright-skill init
```

Then ask your agent:

> generate user stories for this codebase and test them

---

## What you get

`user-stories.xlsx` — and it stays yours. Edit it, reprioritise it, add stories, delete stories,
sort it. The tooling finds rows by story ID, so nothing you do by hand gets clobbered.

| ID | Title | Role | Priority | Status | Severity | Bug / Root Cause | Evidence |
|---|---|---|---|---|---|---|---|
| US-001 | Registered user can log in | registered user | Must | **pass** | | | |
| US-002 | Wrong password is rejected | registered user | Must | **pass** | | | |
| US-003 | Anonymous visitor cannot reach the dashboard | anonymous visitor | Must | **pass** | | | |
| US-004 | Contact form rejects an invalid email | anonymous visitor | Should | **fail** | S2-Critical | `isValidEmail` in `server.mjs:88` only checks the field is non-empty, and the POST handler never re-validates. Addresses with no `@` are written straight to the leads table, so the reply silently bounces. | [trace.zip](#) |

Fifteen columns: the story (`As a … I want … so that …`), Given/When/Then acceptance criteria,
MoSCoW priority, which source files the story came from, and the test result.

## What makes it not just "Playwright, but noisier"

A red test is not a bug. Most first-run failures in a generated suite are the *suite's* fault — a
selector that guessed wrong, a missing wait. Report those as bugs and nobody trusts the sheet
again.

So the agent triages every failure against the trace and the screenshot, and decides:

- **real bug** → severity + root cause in the sheet, stays red
- **bad spec** → fixes the test, re-runs it, reports nothing
- **wrong story** → the feature never worked that way; corrects the story, marks it `blocked`

"Expected `/dashboard`, got `/login`" is a symptom. "The session cookie is set without a `Path`,
so it isn't sent on the redirect" is a root cause. The sheet gets the second kind.

## How it works

```
codebase ──(agent reads)──> stories.json ──> user-stories.xlsx
                                                    │
user-stories.xlsx ──> (agent writes) ──> tests/stories/*.spec.ts
                                                    │
                          npx playwright test --reporter=json
                                                    │
                       results.json ──> user-stories.xlsx  [Status, Evidence]
                                                    │
                 agent opens the trace for each failure, classifies it
                                                    │
                       triage.json ──> user-stories.xlsx  [Severity, Root Cause]
```

Two layers, deliberately split:

- **Judgement** (`SKILL.md` + `references/`) — deriving stories, writing specs, diagnosing
  failures. Prose the LLM follows.
- **Determinism** (`scripts/*.mjs`) — Excel I/O and report parsing. Plain Node, unit-tested, no
  LLM. The part that must not hallucinate is code, not a prompt.

Each generated spec carries its story ID twice, as a tag and as a structured annotation:

```ts
test('US-001: Registered user can log in with valid credentials', {
  tag: '@US-001',
  annotation: { type: 'story', description: 'US-001' },
}, async ({ page }) => {
  // Given: I am on /login
  await page.goto('/login');

  // When: I submit my correct email and password
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Log in' }).click();

  // Then: I am redirected to /dashboard
  await expect(page).toHaveURL('/dashboard');
});
```

The tag drives `npx playwright test --grep @US-001`. The annotation is what joins the result back
to the row. Given/When/Then are comments — no Cucumber, no `.feature` files, no step definitions.
A BDD framework here would cost you the native Playwright runner and buy nothing.

---

## Install

```bash
cd your-website-repo
npx userstory-playwright-skill init

npm install -D @playwright/test exceljs
npx playwright install --with-deps chromium

cp .env.example .env      # set BASE_URL, and test credentials if the app has a login
```

`init` writes real files, not symlinks (those break on Windows). It never overwrites anything
without `--force`, and it *appends* to an existing `AGENTS.md` rather than replacing it.

Install for only some agents:

```bash
npx userstory-playwright-skill init --agents claude,codex
```

### Per-agent setup

The skill body lives once, at `.agents/skills/user-story-testing/`. Everything below either reads
that path natively or is a three-line pointer at it.

<table>
<tr><th>Agent</th><th>What init writes</th><th>How to use it</th></tr>

<tr><td><b>Claude Code</b></td>
<td><code>.claude/skills/user-story-testing/</code></td>
<td>Nothing else to do. Claude loads the skill on description match, or invoke it explicitly:<br><br>

```
> generate user stories for this codebase and test them
```
</td></tr>

<tr><td><b>OpenAI Codex CLI</b></td>
<td><code>.agents/skills/user-story-testing/</code><br><code>AGENTS.md</code> (appended)</td>
<td>Codex scans <code>.agents/skills</code> natively. List it with <code>/skills</code>, or:<br><br>

```
$ codex
> $user-story-testing
```
</td></tr>

<tr><td><b>OpenCode</b></td>
<td><code>.agents/skills/user-story-testing/</code><br>(also reads the <code>.claude/</code> path)</td>
<td>Reads <code>SKILL.md</code> natively from either location. Nothing else to do.<br><br>

```
$ opencode
> run a QA pass over this site
```
</td></tr>

<tr><td><b>Kilo Code</b></td>
<td><code>.kilocode/rules/user-story-testing.md</code></td>
<td>Kilo has no <code>SKILL.md</code> support, so it gets a rule file that points at the canonical skill. Rules are always loaded — just ask:<br><br>

```
> generate user stories and test them
```
</td></tr>

<tr><td><b>GitHub Copilot CLI</b></td>
<td><code>.github/agents/user-story-testing.agent.md</code><br><code>AGENTS.md</code> (appended)</td>
<td>Uses Copilot's custom-agent format:<br><br>

```bash
copilot --agent user-story-testing \
  --prompt "generate user stories and test them"
```

Needs the standalone <code>copilot</code> CLI. The old <code>gh copilot</code> extension was retired in October 2025 and will not work.
</td></tr>
</table>

Under the hood this works because **Agent Skills** ([agentskills.io](https://agentskills.io)) became
an open standard in December 2025 — Claude Code, Codex CLI and OpenCode all read the exact same
`SKILL.md`. Kilo Code and Copilot use their own formats, so they get a pointer file. One canonical
skill body; no duplicated prose to drift.

---

## Using it

### 1. generate

The agent reads your routes, forms, auth flows and actions, and derives stories from them. If you
give it a running `baseURL` it will also visit the pages to confirm the flows and pin down real
selectors — optional, but it makes the first run much cleaner.

**It stops and asks you before writing anything.** A mid-sized app yields 80+ stories. Whether
that's what you want is your call, not a hardcoded cap.

### 2. run

The agent asks you for the `baseURL` and, if the app isn't running, the command that starts it —
it does not guess that from your `package.json`. Then it writes one spec per story, runs the
suite, and syncs the results.

Stories that need a login run against a stored `storageState`: `tests/auth.setup.ts` logs in once
with the credentials from `.env`. Adjust it to match your real login form.

### 3. triage

For each failure the agent opens the trace, works out what actually broke, and writes a root cause
and a severity into the sheet — or quietly fixes its own bad selector and re-runs.

Severity is impact, and is independent of the story's priority:

| | |
|---|---|
| `S1-Blocker` | Core flow unusable, no workaround |
| `S2-Critical` | Major function broken, or data integrity / security at risk |
| `S3-Major` | Feature broken, workaround exists |
| `S4-Minor` | Cosmetic or edge case |
| `S5-Trivial` | Nitpick |

### Scripts

You normally never call these — the agent does. They're plain Node, no LLM:

```bash
# stories.json -> xlsx
node .agents/skills/user-story-testing/scripts/xlsx-init.mjs --stories stories.json

# xlsx -> JSON (optionally filtered)
node .agents/skills/user-story-testing/scripts/xlsx-read.mjs --status fail

# Playwright JSON report -> xlsx
node .agents/skills/user-story-testing/scripts/xlsx-sync.mjs --results test-results/results.json

# agent's diagnosis -> xlsx
node .agents/skills/user-story-testing/scripts/xlsx-sync.mjs --triage triage.json
```

---

## The demo

`fixtures/demo-app/` is a small Express app with a login, a protected dashboard and a public
contact form — and exactly one planted bug: the contact form's email validation only checks that
the field is non-empty, so `notanemail` is accepted and stored.

CI runs the whole cycle against it on every push and asserts the sheet reports **that bug and only
that bug**:

```bash
npm install
npx playwright install chromium
node test/verify-demo.mjs
```

```
1/4  generate: stories.json -> user-stories.xlsx
2/4  run: playwright against the demo app
3/4  sync: report -> user-stories.xlsx
4/4  verify: the sheet reports exactly the planted bug

OK — 3 stories green, US-004 red with the bug and its trace recorded.
```

## Security

Credentials live in `.env`, which `init` adds to `.gitignore` along with `.auth/`. Never commit
either. The skill is instructed never to write a credential into a story, a spec or the sheet.

Point this at a **test environment**. It fills in forms and submits them; that is the entire idea.

## Requirements

Node 18+. Everything else is installed by the two commands above.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports, new agent adapters and better triage
heuristics all welcome.

## License

[MIT](LICENSE)
