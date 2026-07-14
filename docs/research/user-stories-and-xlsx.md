# Reference: User Stories for E2E Testing + Excel Round-Trip Generation

## PART A — User Stories & Acceptance Criteria for E2E Testing

### A.1 Standard formats

**User story template** (Connextra/Mike Cohn format):
```
As a <role>
I want <goal/action>
So that <benefit/value>
```

**INVEST criteria** (Bill Wake, creator of the mnemonic) — a good story is:
- **I**ndependent — codeable/testable/releasable without depending on other stories
- **N**egotiable — a placeholder for conversation, not a frozen spec
- **V**aluable — delivers value to a user or customer
- **E**stimable — team can size it
- **S**mall — fits in an iteration
- **T**estable — has clear pass/fail conditions
(https://www.bacareermentor.com/post/what-makes-a-great-user-story, https://medium.com/tri-petch-digital/writing-effective-user-stories-from-invest-to-gherkin-95f4246a7910)

**Acceptance criteria styles:**
1. **Given/When/Then (Gherkin)** — BDD-style scenario:
   ```gherkin
   Given <initial context/state>
   When <action taken>
   Then <expected outcome>
   ```
   Given sets up preconditions, When is the trigger action, Then is the observable/verifiable result. Effective ACs focus on behavior, not implementation. (https://testquality.com/gherkin-user-stories-acceptance-criteria-guide/, https://christoph-grotz.medium.com/gherkin-style-acceptance-criteria-in-user-stories-bb68bab1cc52)
2. **Checklist / rule-oriented** — flat bullet list of pass/fail rules, no narrative structure:
   ```
   - Email field rejects invalid formats
   - Password must be >= 8 chars
   - Error banner shown on failed login
   - Successful login redirects to /dashboard
   ```
   Faster to write for simple CRUD/validation stories; Gherkin is better when there are multiple flows/branches worth turning directly into test scenarios.

Practical workflow: write the story → apply INVEST to check it's sliceable/testable → write ACs in Given/When/Then (if it will become automated E2E scenarios) or checklist (if it's simple business rules) → derive Definition of Ready / Definition of Done. (https://medium.com/tri-petch-digital/writing-effective-user-stories-from-invest-to-gherkin-95f4246a7910)

### A.2 Deriving stories from an EXISTING codebase (reverse-engineering)

No single standardized tool dominates; the practice is emerging, LLM-assisted:

- **Source-driven extraction**: feed a function/route/component (up to ~200 NLOC per unit for reliable results) to an LLM with the user-story template and one example; this matches larger-model output quality with an 8B model given a single few-shot example. Source code is treated as the most persistent artifact — it outlives design docs, especially in legacy systems. (arXiv "Reverse Engineering User Stories from Code using Large Language Models", https://arxiv.org/html/2509.19587v1)
- **Multi-pass static-analysis + LLM pipeline** (used by reverse-engineering tools/skills):
  1. Static analysis first (ctags, tree-sitter) to enumerate functions/routes/components as discrete units.
  2. Feed module-level chunks to the LLM one at a time (avoids context blowup on large repos).
  3. Cross-reference/link outputs into a searchable index (map of story → source symbol).
  4. Iterative refinement using summaries/dependency maps to catch cross-cutting stories (auth, permissions) that span files.
  (https://agentskills.so/skills/jschulte-claude-plugins-reverse-engineer, https://www.vectorworx.ai/blog/reverse-engineering-legacy-codebases)
- **Reversa framework**: produces an intermediate "operational specification" layer, traceable to code, each item tagged with a confidence level and evidence — expected behavior, domain rules, dependencies, flows. This spec layer is then turned into user stories. Useful pattern: don't jump straight from code to story, insert a verifiable spec/evidence layer in between so a human can audit provenance. (https://arxiv.org/html/2605.18684v1)
- **Practical entry points for extraction** (not just LLM-specific, general practice): enumerate routes (Express/Next.js/Rails route tables, OpenAPI/Swagger specs) → each route = candidate story ("As a <role from auth/middleware> I want to <HTTP verb + resource> so that <inferred benefit>"); enumerate form components (their required fields + validation = acceptance criteria candidates); enumerate auth/authorization middleware (role checks = the "As a <role>" persona list); enumerate state-changing UI actions (buttons/mutations) as goals.
- Source: SCNsoft's legacy reverse-engineering best practices (general, not story-specific) recommends: build dependency maps first, document as you decompose, validate reconstructed behavior against the running app rather than trusting decomposition alone. (https://www.scnsoft.com/software-development/about/how-we-work/reverse-engineering)

**Bottom line**: no dedicated mainstream "codebase → user stories" CLI has broad adoption yet (mid-2026); teams either (a) hand-roll an LLM pipeline over routes/components/auth middleware as above, or (b) use general reverse-engineering skills/agents that emit user stories as one of several output artifacts (e.g. the "reverse-engineer" agent skill referenced above). Treat any generated story as a draft needing human review against the live app — this is the same "verify against running behavior" principle from classic reverse-engineering guidance.

### A.3 Spreadsheet fields for E2E-executable user stories

Minimum practical column set for a "user story tracker that becomes E2E tests":

| Column | Purpose |
|---|---|
| `ID` | Stable key (e.g. `US-001`), used as cross-reference from test code/bug reports |
| `Title` | Short name |
| `Role/Persona` | The "As a ___" actor (maps to auth role / test fixture) |
| `Goal` | The "I want ___" |
| `Benefit` | The "so that ___" (why — helps prioritize) |
| `Priority (MoSCoW)` | Must/Should/Could/Won't-have this iteration |
| `Acceptance Criteria (Given/When/Then)` | One row per scenario, or a multi-line cell with numbered scenarios |
| `Preconditions` | Required state/fixtures before the test can run (logged in, seed data, feature flag) |
| `Test Steps` | Numbered UI actions matching the Playwright script |
| `Expected Result` | What "pass" looks like, independent of implementation |
| `Source Files` | File paths/routes/components the story was derived from (traceability back to code) |
| `Status` | Draft / Ready / Automated / Passing / Failing / Blocked |
| `Severity` (of any bug found) | See taxonomy below |
| `Bug Notes` | Free text on the defect found while testing this story |
| `Evidence Links` | Screenshot/video/trace artifact paths or URLs from the Playwright run |

MoSCoW = **M**ust have, **S**hould have, **C**ould have, **W**on't have (this time) — standard prioritization taxonomy, pairs naturally with a priority column separate from severity.

### A.4 Bug severity/priority taxonomy for the "problems found" column

Two independent axes — don't conflate them:

- **Severity** = technical/functional impact of the defect on the system, independent of business context.
- **Priority** = order in which it should be fixed, decided by business/release context. A high-severity bug is not automatically high priority and vice versa. (https://www.qamadness.com/bug-severity-vs-priority/, https://betterqa.co/bug-priority-vs-severity-levels/)

**S1–S5 severity scale** (common industry convention):

| Level | Name | Meaning |
|---|---|---|
| S1 | Blocker | Crash/hang, no workaround, testing/usage cannot proceed |
| S2 | Critical | Major feature broken; a workaround may exist |
| S3 | Major | Feature works incorrectly but system remains usable |
| S4 | Minor | Confusing/undesirable behavior, small impact |
| S5 | Trivial | Cosmetic only (typos, spacing, non-blocking visuals) |
(https://www.toolsqa.com/software-testing/severity-vs-priority/, https://www.softwaretestingclass.com/defect-severity/)

**Alternative common labels** (equivalent mapping, used by Jira/Bugzilla-style trackers): Blocker → Critical → Major → Minor → Trivial. Use whichever vocabulary matches the target bug tracker so severities transfer without translation.

**Priority scale** (typically P1–P4, orthogonal to severity): P1 = fix immediately/blocks release, P2 = fix before next release, P3 = fix when convenient, P4 = backlog/nice-to-have. A severity-vs-priority matrix (5x5) is a common way to jointly triage. (https://bugreel.io/blog/severity-vs-priority-guide, https://betterqa.co/bug-priority-vs-severity-levels/)

Recommendation for the spreadsheet: keep **Severity** (S1–S5) and **Priority** (MoSCoW or P1–P4) as two separate columns, both keyed off the same defect, plus a free-text **Bug Notes** column for repro steps/root cause.

### A.5 Gherkin → Playwright mapping: pitfalls and pragmatic middle ground

**Two real options, and a hybrid:**

1. **Cucumber.js + Playwright** — Cucumber parses `.feature` files and dispatches to Playwright as the driver. Full BDD framework: `.feature` files + separate step-definition files that must stay in sync. Pitfalls:
   - Every Gherkin line needs a matching step-definition binding → duplicated maintenance surface (spec text vs. glue code).
   - Cucumber becomes the test runner instead of Playwright Test, so you lose native fixtures, parallel workers, and some tracing/reporting integration; more boilerplate overall.
   - Anti-pattern: packing multiple behaviors into one scenario makes failures hard to localize; asserting on brittle CSS selectors inside step defs breaks tests on minor UI changes — hide selectors behind Page Objects, assert on visible behavior only.
   (https://qaskills.sh/blog/cucumber-vs-playwright-2026, https://www.browserstack.com/guide/playwright-bdd)

2. **`playwright-bdd`** — parses Gherkin but compiles it to native Playwright Test files, so Playwright's own runner stays in control (fixtures, auto-wait, tracing, parallel workers all preserved). Generally the sweet spot if literal `.feature` files are a hard requirement (e.g. for non-technical stakeholders to read/write scenarios). (https://qaskills.sh/blog/cucumber-vs-playwright-2026, https://testdino.com/blog/playwright-bdd)

3. **Pragmatic middle ground (recommended for most teams, incl. this project)**: skip `.feature` files and Cucumber entirely. Keep Given/When/Then only as **comments or structured logging inside plain Playwright Test blocks** — no separate runner, no step-definition indirection, no extra dependency:
   ```ts
   test('US-014: user resets password via email link', async ({ page }) => {
     // Given the user is on the login page and has forgotten their password
     await page.goto('/login');
     await page.getByRole('link', { name: 'Forgot password?' }).click();

     // When they submit their email
     await page.getByLabel('Email').fill('user@example.com');
     await page.getByRole('button', { name: 'Send reset link' }).click();

     // Then a confirmation message is shown
     await expect(page.getByText('Check your email')).toBeVisible();
   });
   ```
   This keeps the spreadsheet's Given/When/Then acceptance criteria human-readable and traceable 1:1 into test code (via the `US-xxx` ID in the test title), without building/maintaining a full BDD framework. Use this unless there's an explicit requirement for business stakeholders to read/write raw `.feature` files. (https://dev.to/anubhav_chattopadhyay/playwright-bdd-without-cucumber-typescript-decorators-and-datatables-b31, https://javascript.plainenglish.io/playwright-bdd-testing-you-dont-need-cucumber-ae38085c51b7)

---

## PART B — Excel (.xlsx) Generation & Round-Trip Editing

### B.1 Node.js library comparison

| | **exceljs** | **xlsx (SheetJS CE)** | **write-excel-file** |
|---|---|---|---|
| Weekly downloads (2026) | ~1.9M | ~7.8M | niche |
| Maintenance | Actively maintained | **npm package abandoned**; fixes only via cdn.sheetjs.com, not npm registry | Actively maintained |
| Known CVEs | none significant | **CVE-2023-30533** (prototype pollution, all CE ≤0.19.2, fixed only in 0.19.3 which is *not* on npm — only at cdn.sheetjs.com); **CVE-2024-22363** (ReDoS, fixed in 0.20.2, same distribution problem) | none reported |
| License | MIT | Apache-2.0 (CE); Pro is commercial | MIT |
| Styled headers / cell styles | Yes, full | Yes but weaker styling API | Yes (style objects) |
| Data validation dropdowns | Yes (`cell.dataValidation`) | Limited/undocumented | **No** (needs 3rd-party `@onparallel/write-excel-file-data-validation` addon) |
| Conditional formatting | Yes (`addConditionalFormatting`, subset of rule types) | Minimal | Yes (`conditionalFormatting` option, basic operators) |
| Hyperlinks | Yes (`cell.value = {text, hyperlink}`) | Yes (`cell.l = {Target}`) | Not built-in |
| Freeze panes / autofilter | Yes (`worksheet.views`, `worksheet.autoFilter`) | Yes but manual XML-level | No documented autofilter support |
| **Re-open existing file & edit without destroying formatting** | Yes: `workbook.xlsx.readFile()` then mutate then `writeFile()` — preserves styles/data validation/conditional formatting for elements it understands. **Caveat: charts and some images are dropped on round-trip** (GitHub issues #1734, #2949) | Loads whole workbook into memory (50MB file → 300–400MB heap); read/write supported but weaker fidelity for styles round-trip | **Write-only** — no `readFile`/round-trip API at all; cannot reopen and patch an existing file |
| Streaming for large files | Yes, dedicated streaming writer API, ~6x less memory than SheetJS on 100k rows | No streaming by default (Pro tier adds it) | N/A |

Sources: https://www.pkgpulse.com/blog/sheetjs-vs-exceljs-vs-node-xlsx-excel-files-node-2026, https://mfyz.com/nodejs-excel-library-comparison/, https://cdn.sheetjs.com/advisories/CVE-2023-30533, https://github.com/advisories/GHSA-4r6h-8v6p-xvw6, https://github.com/exceljs/exceljs/issues/1734, https://github.com/exceljs/exceljs/issues/2949, https://www.npmjs.com/package/write-excel-file, https://exceljs.org/

**Verdict**: `exceljs` is the only one of the three that satisfies *all* of: styled headers, dropdown data validation, conditional formatting, hyperlinks, freeze panes, autofilter, AND re-open-and-patch-in-place. `xlsx`/SheetJS has an unpatched CVE trail on npm and weaker native styling/validation support — avoid for a new project unless multi-format (ODS/XLS/CSV) support is required. `write-excel-file` is disqualified outright for this use case because it has no round-trip/read API — it can only generate new files, not update existing ones.

### B.2 Python — openpyxl equivalent capabilities

`openpyxl` covers the same surface as exceljs:

- **Data validation dropdown**:
  ```python
  from openpyxl import Workbook
  from openpyxl.worksheet.datavalidation import DataValidation

  wb = Workbook()
  ws = wb.active
  dv = DataValidation(type="list", formula1='"Dog,Cat,Bat"', allow_blank=True)
  dv.error = 'Your entry is not in the list'
  dv.prompt = 'Please select from the list'
  ws.add_data_validation(dv)
  dv.add('B1:B1048576')   # apply to a range; validations with no ranges are ignored on save
  ```
  (https://openpyxl.readthedocs.io/en/3.1/validation.html)
- **Conditional formatting**: `openpyxl.formatting.rule` (`CellIsRule`, `ColorScaleRule`, `FormulaRule`) applied via `ws.conditional_formatting.add(range, rule)`. (https://openpyxl.readthedocs.io/en/3.1/formatting.html)
- **Freeze panes**: `ws.freeze_panes = "B2"` — freezes all rows above / columns left of the given cell.
- **Hyperlinks**: `cell.hyperlink = "https://example.com"` plus optional `cell.style = "Hyperlink"` for the blue/underline look.
- **Re-open + edit**: `load_workbook(path)` → mutate cells → `wb.save(path)`. For large files use `read_only=True` (load) / `write_only=True` (save) to cut memory, at the cost of losing access to charts/images in that mode.
- **Round-trip caveat (same class of limitation as exceljs)**: openpyxl does not read every part of the OOXML package — **images and charts are dropped** if a file is opened and re-saved under the same name. Only cell values/styles/hyperlinks/comments and basic sheet attributes survive a worksheet copy; conditional formatting and data validation are generally preserved through plain `load_workbook`/`save` (not officially guaranteed for every rule type, but the common cases work). (https://openpyxl.readthedocs.io/en/2.4/usage.html general behavior notes, cross-referenced against community reports)

### B.3 Recommendation for this project's requirement

Requirement: (1) generate an xlsx of user stories, (2) later re-open that *same* file and write test results/bugs back into it without clobbering manual edits.

**Use `exceljs`** if the tool is Node/TypeScript (matches a Playwright-CLI-skill project already in the JS/TS ecosystem):
- It is the only Node library with full native support for dropdowns + conditional formatting + hyperlinks + freeze panes/autofilter *and* a read-modify-write cycle on an existing file.
- Practical rule to protect manual edits: never regenerate the whole sheet on update — open the existing file, locate rows by the `ID` column, write only to the specific result/status/severity/bug-notes/evidence-link cells for that row, and save. Do not touch cells outside the "test execution" columns.
- Avoid embedding charts/images in this workbook (or accept they'll be dropped on the first automated update pass) — this is the one real limitation of both exceljs and openpyxl on round-trip.

**Use `openpyxl`** if the tooling is Python — equivalent capability and equivalent round-trip caveat (charts/images only).

Do not use SheetJS/`xlsx` for new work given the outstanding CVEs and the fact that the patched version is not distributed via npm.

### B.4 Minimal working example: exceljs create → later re-open/update → save

```js
// generate.js — first run: create the user-story workbook
const ExcelJS = require('exceljs');

async function generate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('User Stories');

  ws.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Title', key: 'title', width: 30 },
    { header: 'Role', key: 'role', width: 15 },
    { header: 'Priority', key: 'priority', width: 12 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Severity', key: 'severity', width: 12 },
    { header: 'Bug Notes', key: 'bugNotes', width: 40 },
    { header: 'Evidence', key: 'evidence', width: 30 },
  ];

  // styled header row
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' },
  };

  ws.addRow({
    id: 'US-001', title: 'User can reset password', role: 'Registered user',
    priority: 'Must', status: 'Ready', severity: '', bugNotes: '', evidence: '',
  });
  ws.addRow({
    id: 'US-002', title: 'User can view order history', role: 'Registered user',
    priority: 'Should', status: 'Ready', severity: '', bugNotes: '', evidence: '',
  });

  // MoSCoW dropdown on Priority column (D)
  ws.getColumn('priority').eachCell({ includeEmpty: true }, (cell, rowNum) => {
    if (rowNum === 1) return;
    cell.dataValidation = {
      type: 'list', allowBlank: false,
      formulae: ['"Must,Should,Could,Won\'t"'],
    };
  });

  // Status dropdown (E)
  ws.getColumn('status').eachCell({ includeEmpty: true }, (cell, rowNum) => {
    if (rowNum === 1) return;
    cell.dataValidation = {
      type: 'list', allowBlank: false,
      formulae: ['"Draft,Ready,Automated,Passing,Failing,Blocked"'],
    };
  });

  // Conditional formatting: red when Status = Failing, green when Passing
  ws.addConditionalFormatting({
    ref: `E2:E1000`,
    rules: [
      {
        type: 'containsText', operator: 'containsText', text: 'Failing',
        style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } } },
      },
      {
        type: 'containsText', operator: 'containsText', text: 'Passing',
        style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } } },
      },
    ],
  });

  ws.views = [{ state: 'frozen', ySplit: 1 }]; // freeze header row
  ws.autoFilter = 'A1:H1';

  await wb.xlsx.writeFile('user-stories.xlsx');
}

generate();
```

```js
// update.js — later run: re-open the SAME file and write test results/bugs
// without touching any cell the user manually edited outside the target columns.
const ExcelJS = require('exceljs');

async function updateResults(results) {
  // results = [{ id: 'US-001', status: 'Failing', severity: 'S2',
  //              bugNotes: 'Reset link 404s', evidence: 'artifacts/US-001-trace.zip' }, ...]

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('user-stories.xlsx');   // preserves existing styles/validation/formatting
  const ws = wb.getWorksheet('User Stories');

  const header = ws.getRow(1).values;            // ['', 'ID', 'Title', ...] (1-indexed)
  const colIndex = (name) => header.indexOf(name);
  const idCol = colIndex('ID');
  const statusCol = colIndex('Status');
  const severityCol = colIndex('Severity');
  const bugNotesCol = colIndex('Bug Notes');
  const evidenceCol = colIndex('Evidence');

  const byId = new Map(results.map(r => [r.id, r]));

  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return; // skip header
    const id = row.getCell(idCol).value;
    const result = byId.get(id);
    if (!result) return; // leave row untouched -> preserves any manual edits

    row.getCell(statusCol).value = result.status;
    row.getCell(severityCol).value = result.severity;
    row.getCell(bugNotesCol).value = result.bugNotes;
    row.getCell(evidenceCol).value = {
      text: 'view trace', hyperlink: result.evidence,
    };
  });

  await wb.xlsx.writeFile('user-stories.xlsx'); // same path -> in-place update
}

updateResults([
  { id: 'US-001', status: 'Failing', severity: 'S2', bugNotes: 'Reset link 404s in prod', evidence: 'artifacts/US-001-trace.zip' },
]);
```

Key points demonstrated:
- `workbook.xlsx.readFile()` + targeted per-row cell writes + `writeFile()` to the same path is the round-trip pattern that avoids clobbering manual edits (only touch the columns you own).
- Data validation dropdowns and conditional formatting set on `generate.js` remain intact after `update.js` runs, because exceljs re-serializes the whole workbook model it parsed rather than truncating unknown cells — the only things it silently drops are chart/image objects (not used here, so no exposure).
- Hyperlink evidence links use the `{ text, hyperlink }` cell-value form, not a raw formula string, so the link is a real OOXML hyperlink relationship.

---

## Citations

- https://www.bacareermentor.com/post/what-makes-a-great-user-story
- https://medium.com/tri-petch-digital/writing-effective-user-stories-from-invest-to-gherkin-95f4246a7910
- https://testquality.com/gherkin-user-stories-acceptance-criteria-guide/
- https://christoph-grotz.medium.com/gherkin-style-acceptance-criteria-in-user-stories-bb68bab1cc52
- https://arxiv.org/html/2509.19587v1 (Reverse Engineering User Stories from Code using LLMs)
- https://arxiv.org/html/2605.18684v1 (Reversa framework)
- https://agentskills.so/skills/jschulte-claude-plugins-reverse-engineer
- https://www.vectorworx.ai/blog/reverse-engineering-legacy-codebases
- https://www.scnsoft.com/software-development/about/how-we-work/reverse-engineering
- https://www.qamadness.com/bug-severity-vs-priority/
- https://betterqa.co/bug-priority-vs-severity-levels/
- https://www.toolsqa.com/software-testing/severity-vs-priority/
- https://www.softwaretestingclass.com/defect-severity/
- https://bugreel.io/blog/severity-vs-priority-guide
- https://qaskills.sh/blog/cucumber-vs-playwright-2026
- https://www.browserstack.com/guide/playwright-bdd
- https://testdino.com/blog/playwright-bdd
- https://dev.to/anubhav_chattopadhyay/playwright-bdd-without-cucumber-typescript-decorators-and-datatables-b31
- https://javascript.plainenglish.io/playwright-bdd-testing-you-dont-need-cucumber-ae38085c51b7
- https://www.pkgpulse.com/blog/sheetjs-vs-exceljs-vs-node-xlsx-excel-files-node-2026
- https://mfyz.com/nodejs-excel-library-comparison/
- https://cdn.sheetjs.com/advisories/CVE-2023-30533
- https://github.com/advisories/GHSA-4r6h-8v6p-xvw6
- https://github.com/exceljs/exceljs/issues/1734
- https://github.com/exceljs/exceljs/issues/2949
- https://www.npmjs.com/package/write-excel-file
- https://exceljs.org/
- https://openpyxl.readthedocs.io/en/3.1/validation.html
- https://openpyxl.readthedocs.io/en/3.1/formatting.html
- https://openpyxl.readthedocs.io/en/2.4/usage.html
