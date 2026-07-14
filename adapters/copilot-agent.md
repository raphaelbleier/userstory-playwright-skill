---
name: user-story-testing
description: Derive user stories from this codebase into an Excel sheet, test them with Playwright, and write bugs and root causes back into the sheet.
tools: ["read", "write", "edit", "shell"]
---

# User Story Testing

Read and follow the procedure in `.agents/skills/user-story-testing/SKILL.md`, along with the
reference files it points to in `.agents/skills/user-story-testing/references/`.

That file defines three operations — `generate`, `run` and `triage` — and the exact scripts to
call. Follow it as written. The scripts under `.agents/skills/user-story-testing/scripts/` are the
only supported way to read and write `user-stories.xlsx`; do not parse or write the sheet by hand.
