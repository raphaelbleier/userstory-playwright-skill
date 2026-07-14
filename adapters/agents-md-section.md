## User Story Testing

This repo has a user-story E2E testing skill: it derives user stories from the codebase into
`user-stories.xlsx`, turns them into Playwright tests, runs them, and writes failures and their
root causes back into the sheet.

When asked to generate user stories, build an E2E suite, run a QA pass, or track bugs against
stories, follow `.agents/skills/user-story-testing/SKILL.md`.

`user-stories.xlsx` is the source of truth and is owned by the human. Read and write it only via
the scripts in `.agents/skills/user-story-testing/scripts/`.
