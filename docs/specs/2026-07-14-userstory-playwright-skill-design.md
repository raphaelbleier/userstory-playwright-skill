# User Story Playwright Skill — Design

Date: 2026-07-14
Status: Approved

## Problem

Teams have a website codebase and no traceable QA layer. Writing user stories by hand is slow;
turning them into E2E tests is slower; keeping the two in sync never happens. Meanwhile every
coding-agent CLI (Claude Code, Codex, Kilo Code, OpenCode, GitHub Copilot) is capable of doing
all three, but there is no shared, reusable procedure for it.

## What this is

An **Agent Skill** — installed into any website repo — that gives the coding agent three
operations:

1. `generate` — read the codebase, derive user stories, write `user-stories.xlsx`
2. `run` — turn stories into Playwright specs, execute them, write results back into the xlsx
3. `triage` — for each failure, inspect trace/screenshot/error, classify root cause, record
   severity and a human-readable diagnosis in the xlsx

The **xlsx is the source of truth**. The user may edit, delete, reprioritise, and add stories by
hand. Tooling round-trips the file and only patches result columns, keyed by story ID.

## Non-goals

- Not a BDD framework. Given/When/Then lives as comments inside plain `test()` blocks. No
  Cucumber, no `.feature` files, no step definitions.
- Not a test-generation service. The agent writes the specs; the scripts only do the
  deterministic, un-agentic parts (xlsx I/O, report parsing).
- Not a crawler-first tool. Static code reading is the default; crawling a running app is an
  optional enrichment step.

## Architecture

Two layers, deliberately separated:

**Agentic layer** (`SKILL.md` + `references/`) — instructions the LLM follows. Deriving stories
from code, writing specs, diagnosing failures. This is judgement work; it stays as prose.

**Deterministic layer** (`scripts/*.mjs`) — plain Node, no LLM, unit-testable. Excel read/write,
Playwright JSON-report parsing, status/severity patching. This is the part that must not
hallucinate, so it is code.

The agent calls the scripts. The scripts never call the agent.

```
codebase ──(agent reads)──> stories.json ──(xlsx-init)──> user-stories.xlsx
                                                                   │
user-stories.xlsx ──(xlsx-read)──> stories.json ──(agent writes)──> tests/stories/*.spec.ts
                                                                   │
                                              npx playwright test --reporter=json
                                                                   │
                                                          results.json
                                                                   │
                                    (xlsx-sync --results) ──> user-stories.xlsx [Status, Evidence]
                                                                   │
                              agent reads trace/screenshot for each failure, classifies
                                                                   │
                                    (xlsx-sync --triage) ──> user-stories.xlsx [Severity, Root Cause]
```

## Distribution

`npx userstory-playwright-skill init` inside the target repo. It writes:

| Agent | Path | Content |
|---|---|---|
| Codex CLI, OpenCode | `.agents/skills/user-story-testing/` | canonical `SKILL.md` + `references/` + `scripts/` |
| Claude Code | `.claude/skills/user-story-testing/` | copy of the same directory |
| Kilo Code | `.kilocode/rules/user-story-testing.md` | pointer to the canonical SKILL.md |
| GitHub Copilot CLI | `.github/agents/user-story-testing.agent.md` | pointer, in `.agent.md` frontmatter format |
| all | `AGENTS.md` | appended section (never overwrites an existing file) |

Real files, not symlinks — symlinks break on Windows and in git checkouts with
`core.symlinks=false`.

Rationale: Agent Skills (agentskills.io, open standard since 2025-12-18) is read natively by
Claude Code, Codex CLI and OpenCode. Kilo Code and Copilot CLI use their own formats and get a
three-line pointer file. One canonical skill body; zero duplicated prose.

Also written into the target repo: `playwright.config.ts`, `tests/auth.setup.ts`, `.env.example`,
and `.gitignore` entries.

## Excel schema

Sheet `Stories`, 15 columns, frozen header row, autofilter.

| # | Column | Written by | Notes |
|---|---|---|---|
| 1 | ID | generate | `US-001`. The join key. Never rewritten. |
| 2 | Title | generate | |
| 3 | Role | generate | the "As a ..." |
| 4 | Goal | generate | the "I want ..." |
| 5 | Benefit | generate | the "so that ..." |
| 6 | Priority | generate | dropdown: Must / Should / Could / Wont (MoSCoW) |
| 7 | Acceptance Criteria | generate | Given / When / Then, newline-separated |
| 8 | Preconditions | generate | |
| 9 | Requires Auth | generate | dropdown: yes / no |
| 10 | Source Files | generate | provenance — which files this story was derived from |
| 11 | Spec File | run | path of the generated spec |
| 12 | Status | run | dropdown: not-run / pass / fail / flaky / skipped / blocked. Conditional formatting: green / red / amber. |
| 13 | Severity | triage | dropdown: S1-Blocker / S2-Critical / S3-Major / S4-Minor / S5-Trivial. Only meaningful when Status=fail. |
| 14 | Bug / Root Cause | run, then triage | run writes the raw Playwright error; triage replaces it with a diagnosis. |
| 15 | Evidence | run | hyperlink to trace.zip / screenshot |

Severity and Priority are independent axes. A trivial bug in a Must-have story is still trivial.

Columns 1-10 are the user's. Tooling never touches them after `generate`.

## Story ↔ test linkage

Every generated spec carries the story ID twice:

```ts
test('US-001: visitor can register', {
  tag: '@US-001',
  annotation: { type: 'story', description: 'US-001' },
}, async ({ page }) => {
  // Given: visitor is on /register
  // When:  a valid email and password are submitted
  // Then:  redirected to /dashboard, greeting is visible
});
```

The tag drives `--grep @US-001` for single-story runs. The annotation is the structured channel
read out of the JSON report — tags arrive there with the `@` stripped and carry no type, so they
are the weaker key. `xlsx-sync` reads the annotation and falls back to the tag.

Parsing note that cost us a bug in design: `JSONReportTest.status` is
`skipped|expected|unexpected|flaky`, while `JSONReportTestResult.status` is
`passed|failed|timedOut|skipped|interrupted`. `xlsx-sync` maps from the *test*-level status,
because that one already accounts for retries and expected failures.

## Auth

`.env` holds test credentials. `tests/auth.setup.ts` logs in once and saves `storageState.json`.
A Playwright project depends on that setup and loads the state; stories with
`Requires Auth = yes` run under it. Standard Playwright pattern, nothing invented.

Nothing in `.env` or `storageState.json` is ever committed — `init` adds both to `.gitignore`.

## Agent must ask, not guess

Two points where the skill stops and asks the user:

1. **Before running**: the app must be reachable. The agent asks for the `baseURL` and, if the app
   needs starting, the dev command. It does not guess from `package.json`.
2. **Before generating**: the agent presents the flows it found and the resulting story count, and
   asks the user to confirm or narrow the scope. A mid-sized app can easily yield 80+ stories;
   the user decides, not a hardcoded cap.

## Verification

`fixtures/demo-app/` — a small Express app with a login, a public contact form, and **one
deliberately planted bug** (the contact form's email validation accepts an address with no `@`).

CI runs the full cycle against it and asserts that the resulting xlsx reports exactly that one
failing story. That proves the loop end to end, and doubles as the README demo.

The deterministic scripts additionally have unit tests (`node:test`) covering: xlsx round-trip
preserves manual edits, JSON-report parsing maps statuses correctly, and the story-ID join
survives multi-project runs.
