# Contributing

Thanks for taking a look. Issues and pull requests are both welcome.

## Getting set up

```bash
git clone https://github.com/raphaelbleier/userstory-playwright-skill
cd userstory-playwright-skill
npm install
npx playwright install chromium

npm test                  # unit tests — fast, no browser
node test/verify-demo.mjs # the full cycle against the demo app
```

Both must pass before a PR can be merged. CI runs them, plus an installer smoke test.

## What lives where

| Path | What it is |
|---|---|
| `skill/SKILL.md` | The procedure the agent follows. The canonical skill body. |
| `skill/references/` | The detail: how to derive stories, author specs, triage failures. |
| `skill/scripts/` | Excel I/O and report parsing. Plain Node, no LLM. |
| `adapters/` | Pointer files for the agents that don't read `SKILL.md`. |
| `templates/` | `playwright.config.ts`, `auth.setup.ts`, `.env.example` — copied into the target repo. |
| `bin/cli.mjs` | The `init` installer. |
| `fixtures/demo-app/` | The app under test, with one planted bug. |

**The line that matters:** anything requiring judgement is prose in `skill/`. Anything that must
not hallucinate is code in `skill/scripts/`, and it has a test. If you find yourself asking the
model to parse a JSON report or compute a cell address, that belongs in a script.

## Changing the sheet

`skill/scripts/lib/schema.mjs` is the single source of truth for the columns. Add a column there
and `init`, `read`, `sync` and the validation all follow. Do not hardcode a column index anywhere
else — use `columnIndex('key')`.

If you add a column, say who owns it (`story` / `run` / `triage`). Tooling must never overwrite a
`story` column outside `generate` — that's the user's data.

## Adding an agent adapter

If a CLI reads `SKILL.md` natively, it needs nothing but a line in the README table. If it
doesn't, add a pointer file to `adapters/` in that agent's format, wire it into `bin/cli.mjs`, and
add it to the installer smoke test in `.github/workflows/ci.yml`.

A pointer file points. It does not restate the procedure — duplicated prose drifts, and then two
agents behave differently for no reason anyone can find.

## Improving triage

`skill/references/triage.md` is the highest-leverage file in the repo. The difference between a
QA report people act on and one they ignore is whether it distinguishes a real bug from a bad
selector. If you have heuristics from real use, they belong there.

## Bugs

Include: the agent CLI and version, Node version, what you asked for, what landed in the sheet,
and what you expected. If a spec was generated wrong, paste it.

## Style

Match what's there. No build step, no TypeScript in `scripts/`, no dependencies beyond `exceljs`.
Comments explain *why*, not *what* — if a line needs a comment to say what it does, rewrite the
line.

## License

Contributions are MIT, same as the project.
