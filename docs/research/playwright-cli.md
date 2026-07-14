# Playwright Technical Reference (2026)

Current published versions: `@playwright/test` 1.61.x, `@playwright/mcp` 0.0.78.

---

## 1. CLI Surface

### `npx playwright test` — core flags

| Flag | Purpose |
|---|---|
| `--project <name...>` | Run only listed projects (from `playwright.config.ts`); supports `*` wildcard |
| `--reporter <name>` | `dot`, `line`, `list`, `json`, `junit`, `html`, `blob`, `github`, or a path to a custom reporter module; comma-separated for multiple |
| `-g, --grep <regex>` | Only run tests whose title matches the regex (also matches `@tag` tokens in titles) |
| `-G, --grep-invert <regex>` | Exclude tests matching regex |
| `--headed` | Run in headed (visible) browser; default is headless |
| `-j, --workers <n\|%>` | Number of parallel workers, or `%` of CPU cores; `--workers=1` = serial |
| `--trace <mode>` | `on`, `off`, `on-first-retry`, `on-all-retries`, `retain-on-failure`, `retain-on-first-failure`, `retain-on-failure-and-retries` |
| `--last-failed` | Re-run only the tests that failed in the previous run |
| `--repeat-each <n>` | Run each test `n` times (stress/flake detection) |
| `--list` | Enumerate matching tests, don't execute |
| `--ui` | Launch UI Mode (interactive watch/debug runner) |
| `--debug` | Playwright Inspector preset: headed, `workers=1`, `timeout=0`, `max-failures=1` |
| `-c, --config <file>` | Explicit config file path |
| `--forbid-only` | Fail the run if `test.only` is present (CI safety net) |
| `--fully-parallel` | Run all tests in all files fully in parallel |
| `--global-timeout <ms>` | Cap total suite runtime |
| `--max-failures <n>, -x` | Stop after N failures |
| `--output <dir>` | Override artifacts output dir (default `test-results/`) |
| `--pass-with-no-tests` | Exit 0 even if no tests matched |
| `--retries <n>` | Max retries per test |
| `--shard <i/n>` | Run shard `i` of `n` (CI distribution) |
| `--timeout <ms>` | Per-test timeout |
| `-u, --update-snapshots [mode]` | Update visual/snapshot baselines |
| `--only-changed [ref]` | Only run tests affected by changes since `ref` (git-diff based) |
| `--ignore-snapshots` | Skip snapshot assertions |
| `--fail-on-flaky-tests` | Treat a passed-on-retry (flaky) test as a failure for exit code purposes |

Example:
```bash
npx playwright test --project=chromium --grep "@US-001" \
  --reporter=list,json --trace=on-first-retry --workers=4
```

### `npx playwright codegen`
Records interactions in a browser and emits test source.
```bash
npx playwright codegen https://example.com
npx playwright codegen -b firefox -o tests/login.spec.ts --target=javascript https://example.com
```
Key flags: `-b/--browser <chromium|firefox|webkit>`, `-o/--output <file>`, `--target <language>` (js/ts/python/java/csharp), `--viewport-size`, `--save-storage`/`--load-storage` (auth state).

### `npx playwright install`
```bash
npx playwright install                # all browsers
npx playwright install chromium       # one browser
npx playwright install --with-deps    # + OS-level dependencies (Linux CI)
npx playwright install --force        # reinstall
npx playwright install --dry-run      # preview only
```

### `npx playwright show-report [dir]`
Serves the HTML report (default dir `playwright-report/`) on `localhost:9323`.

### `npx playwright show-trace [trace.zip | url]`
Opens the Trace Viewer for a given `.zip` locally; can also open remote trace URLs. Web-hosted equivalent: https://trace.playwright.dev (loads entirely client-side, no upload).

### `npx playwright merge-reports <blob-report-dir>`
Combines `blob` reporter shards (from sharded CI runs) into a single report:
```bash
npx playwright merge-reports --reporter html ./all-blob-reports
```

### `npx playwright clear-cache`
Removes Playwright's local caches.

Docs: https://playwright.dev/docs/test-cli · https://playwright.dev/docs/test-cli-reference

---

## 2. Reporters

Configured via `--reporter=` CLI flag or the `reporter` array in `playwright.config.ts`. Multiple reporters can run simultaneously.

| Reporter | Use | Default |
|---|---|---|
| `list` | One line per test, live status | Default when running locally (TTY) |
| `line` | Single overwriting line for most-recent test, terser than `list` | — |
| `dot` | One character per test (`·` pass, `F` fail, `×` fail-will-retry, `±` flaky-passed-on-retry, `T` timeout, `°` skip) | Default on CI |
| `json` | Full machine-readable run data | — |
| `junit` | XML, for CI systems (Jenkins, GitLab, Azure DevOps) | — |
| `html` | Self-contained interactive web report | — |
| `blob` | Binary/zip format, only useful for later `merge-reports` (sharded CI) | — |
| `github` | Adds inline annotations to GitHub Actions logs | — |

```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
});
```
Equivalent via env vars: `PLAYWRIGHT_JSON_OUTPUT_NAME`, `PLAYWRIGHT_JUNIT_OUTPUT_NAME`, `PLAYWRIGHT_HTML_OUTPUT_DIR`, `PLAYWRIGHT_BLOB_OUTPUT_DIR`.

Docs: https://playwright.dev/docs/test-reporters

### JSON reporter — exact schema

Source of truth (verbatim from Playwright's own type definitions,
`packages/playwright/types/testReporter.d.ts`, and the serializer,
`packages/playwright/src/reporters/json.ts`, in microsoft/playwright@main):

```typescript
interface JSONReport {
  config: Omit<FullConfig, 'projects'> & {
    projects: {
      outputDir: string; repeatEach: number; retries: number;
      metadata: Metadata; id: string; name: string; testDir: string;
      testIgnore: string[]; testMatch: string[]; timeout: number;
    }[];
  };
  suites: JSONReportSuite[];
  errors: TestError[];
  stats: {
    startTime: string;   // ISO 8601
    duration: number;    // ms
    expected: number; unexpected: number; flaky: number; skipped: number;
  };
}

interface JSONReportSuite {
  title: string; file: string; column: number; line: number;
  specs: JSONReportSpec[];
  suites?: JSONReportSuite[];       // nested describe() blocks
}

interface JSONReportSpec {
  tags: string[];        // '@' stripped, e.g. ["US-001", "smoke"]
  title: string; ok: boolean; id: string;
  file: string; line: number; column: number;
  tests: JSONReportTest[];  // one entry per project the spec ran under
}

interface JSONReportTest {
  timeout: number;
  annotations: { type: string; description?: string; location?: Location }[];
  expectedStatus: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  projectName: string; projectId: string;
  results: JSONReportTestResult[];   // one per attempt (retries)
  status: 'skipped' | 'expected' | 'unexpected' | 'flaky';
}

interface JSONReportTestResult {
  workerIndex: number; parallelIndex: number; shardIndex?: number;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted' | undefined;
  duration: number;                 // ms
  error: TestError | undefined;     // first error, convenience field
  errors: JSONReportError[];        // { message: string; location?: Location }[]
  stdout: ({ text: string } | { buffer: string })[];
  stderr: ({ text: string } | { buffer: string })[];
  retry: number;
  steps?: JSONReportTestStep[];     // top-level test.step() calls only
  startTime: string;                // ISO 8601
  attachments: { name: string; path?: string; body?: string; contentType: string }[];
  annotations: { type: string; description?: string }[];
  errorLocation?: Location;
}

interface JSONReportTestStep {
  title: string; duration: number;
  error: TestError | undefined;
  steps?: JSONReportTestStep[];     // nested test.step() calls
}
```

Realistic example output (`results.json`, trimmed):

```json
{
  "config": {
    "rootDir": "/repo",
    "projects": [{ "name": "chromium", "outputDir": "test-results", "retries": 1, "repeatEach": 1, "timeout": 30000, "id": "chromium", "testDir": "/repo/tests", "testIgnore": [], "testMatch": ["**/*.spec.ts"], "metadata": {} }]
  },
  "suites": [
    {
      "title": "login.spec.ts",
      "file": "login.spec.ts",
      "column": 0,
      "line": 0,
      "specs": [
        {
          "title": "user can log in with valid credentials",
          "ok": true,
          "tags": ["US-001", "smoke"],
          "id": "a1b2c3",
          "file": "login.spec.ts",
          "line": 12,
          "column": 5,
          "tests": [
            {
              "timeout": 30000,
              "annotations": [
                { "type": "story", "description": "US-001" }
              ],
              "expectedStatus": "passed",
              "projectId": "chromium",
              "projectName": "chromium",
              "status": "expected",
              "results": [
                {
                  "workerIndex": 0,
                  "parallelIndex": 0,
                  "status": "passed",
                  "duration": 842,
                  "error": undefined,
                  "errors": [],
                  "stdout": [],
                  "stderr": [],
                  "retry": 0,
                  "startTime": "2026-07-14T09:12:03.421Z",
                  "steps": [
                    { "title": "Navigate to /login", "duration": 120, "error": undefined },
                    { "title": "Fill credentials and submit", "duration": 300, "error": undefined }
                  ],
                  "attachments": [
                    {
                      "name": "trace",
                      "contentType": "application/zip",
                      "path": "test-results/login-user-can-log-in-chromium/trace.zip"
                    }
                  ],
                  "annotations": [{ "type": "story", "description": "US-001" }]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "errors": [],
  "stats": {
    "startTime": "2026-07-14T09:12:03.000Z",
    "duration": 1204,
    "expected": 1,
    "unexpected": 0,
    "flaky": 0,
    "skipped": 0
  }
}
```

**Programmatic-parsing notes:**
- `tags` on `JSONReportSpec` already has the `@` prefix stripped — `"@US-001"` in source becomes `"US-001"` in JSON.
- `test.status` (on `JSONReportTest`) uses a *different* vocabulary (`skipped|expected|unexpected|flaky`) than `result.status` (`passed|failed|timedOut|skipped|interrupted`) — don't conflate them; `expected`/`unexpected` reflect whether the outcome matched `expectedStatus`, factoring in retries.
- A spec can have multiple `tests[]` entries — one per matrix project (e.g. chromium + firefox).
- A test can have multiple `results[]` — one per retry attempt; the last one is the "final" outcome.
- Attachments include the trace/screenshot/video file *paths* (relative to cwd) when written to disk, or a base64 `body` when inlined.
- `steps` only serializes steps with `category === 'test.step'` (explicit `test.step()` calls), not internal Playwright action steps.

---

## 3. Custom Reporter API

Register in config (class must be default-exported):
```typescript
export default defineConfig({
  reporter: [['./my-reporter.ts', { customOption: 'value' }]],
});
```

`Reporter` interface (`@playwright/test/reporter`), all methods optional:

```typescript
import type { Reporter, FullConfig, Suite, TestCase, TestResult, TestStep, FullResult } from '@playwright/test/reporter';

class MyReporter implements Reporter {
  onBegin(config: FullConfig, suite: Suite) {}          // before any test runs; suite = full discovered tree
  onTestBegin(test: TestCase, result: TestResult) {}    // result is nearly empty at this point
  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {}
  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {}
  onTestEnd(test: TestCase, result: TestResult) {}       // result fully populated: status/duration/errors/attachments
  onError(error: TestError, workerInfo?: WorkerInfo) {}  // unhandled worker exception
  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {}
  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {}
  async onEnd(result: FullResult) {}                     // { status, startTime, duration }; may return { status } override
  async onExit() {}                                      // last hook before process exit — good place to upload
  printsToStdio() { return true; }                        // false = don't suppress default terminal output
}
export default MyReporter;
```

Key data shapes used above (same fields as the JSON reporter draws from):
- **`TestCase`**: `title`, `location {file,line,column}`, `annotations[]`, `tags[]` (raw, with `@`), `id`, `expectedStatus`, `timeout`, `retries`, `results: TestResult[]`, `parent: Suite`.
- **`TestResult`**: `status`, `duration`, `errors: TestError[]`, `error` (first), `attachments[]`, `steps: TestStep[]`, `stdout[]`, `stderr[]`, `retry`, `startTime`, `workerIndex`, `parallelIndex`.

Minimal example that writes a custom JSON keyed by story tag:
```typescript
class StoryReporter implements Reporter {
  private byStory: Record<string, any[]> = {};
  onTestEnd(test: TestCase, result: TestResult) {
    for (const tag of test.tags) {
      (this.byStory[tag] ??= []).push({ title: test.title, status: result.status, duration: result.duration });
    }
  }
  onEnd() { require('fs').writeFileSync('by-story.json', JSON.stringify(this.byStory, null, 2)); }
}
```

Docs: https://playwright.dev/docs/test-reporter-api · https://playwright.dev/docs/api/class-reporter · https://playwright.dev/docs/api/class-testcase · https://playwright.dev/docs/api/class-testresult

---

## 4. `test.step()`, tags, describe, fixtures — linking to external IDs

### `test.step()`
```typescript
test('user can log in', async ({ page }) => {
  await test.step('Navigate to login page', async () => {
    await page.goto('/login');
  });
  const user = await test.step('Submit credentials', async () => {
    await page.fill('#user', 'alice');
    await page.click('button[type=submit]');
    return 'alice';
  });
  expect(user).toBe('alice');
});
```
Steps nest (`test.step` inside `test.step`), can return values, and accept options `{ box, location, timeout }`. They show up in `list`/HTML/JSON reporters and as a timeline in Trace Viewer.

### Tags
```typescript
test('login works @US-001 @smoke', async ({ page }) => { /* ... */ });
// or, structured:
test('login works', { tag: ['@US-001', '@smoke'] }, async ({ page }) => { /* ... */ });
test.describe('Auth', { tag: '@US-001' }, () => { /* all tests inherit the tag */ });
```
Filter:
```bash
npx playwright test --grep @US-001                       # only US-001
npx playwright test --grep-invert @slow                  # exclude
npx playwright test --grep "@US-001|@US-002"              # OR
npx playwright test --grep "(?=.*@US-001)(?=.*@smoke)"    # AND
```
Also filterable via config: `testConfig.grep` / `testProject.grep`.

### Annotations (richer than tags — carry structured metadata)
```typescript
test('login works', {
  annotation: { type: 'story', description: 'US-001' },
}, async ({ page }) => { /* ... */ });

// or at runtime, inside the test body:
test('login works', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'story', description: 'US-001' });
});
```
Annotations appear in the HTML report, and in `TestCase.annotations` / `JSONReportTest.annotations` for programmatic consumption — this is the recommended mechanism to link a test back to an external user-story/requirement ID, since (unlike tags) they carry a `type` + free-text `description` and don't affect `--grep` filtering.

**Practical recommendation for linking tests to user stories:** use a tag (`@US-001`) for fast CLI filtering/selection, *and* a structured annotation (`{ type: 'story', description: 'US-001' }`) for reliable programmatic extraction from the JSON reporter — tags are stripped of noise but only exist as strings; annotations are the structured channel.

### `test.describe`
Groups related tests; supports the same `{ tag, annotation }` options, inherited by children:
```typescript
test.describe('Checkout flow', { tag: '@US-042' }, () => {
  test('applies discount code', async ({ page }) => { /* ... */ });
  test('rejects expired code', async ({ page }) => { /* ... */ });
});
```

### Fixtures
Custom setup/teardown, test- or worker-scoped, via `test.extend`:
```typescript
import { test as base } from '@playwright/test';

export const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('#user', 'alice');
    await page.click('button[type=submit]');
    await use(page);          // hand to the test
    // teardown after test
  },
});
```
Worker-scoped (shared across tests in a worker, e.g. expensive setup):
```typescript
export const test = base.extend<{}, { account: Account }>({
  account: [async ({}, use) => {
    const acct = await createAccount();
    await use(acct);
    await acct.delete();
  }, { scope: 'worker' }],
});
```

Docs: https://playwright.dev/docs/test-annotations · https://playwright.dev/docs/api/class-test#test-step · https://playwright.dev/docs/test-fixtures

---

## 5. Config essentials (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',                 // recursively scanned for spec files
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],
});
```

- `use.trace`: `off | on | on-first-retry | on-all-retries | retain-on-failure | retain-on-first-failure | retain-on-failure-and-retries`
- `use.screenshot`: `off | on | only-on-failure`
- `use.video`: same value set as `trace`

Docs: https://playwright.dev/docs/test-configuration · https://playwright.dev/docs/api/class-testconfig · https://playwright.dev/docs/test-use-options

---

## 6. Artifact paths

Default output root: `test-results/` (override with `--output` or `use.outputDir`). Each test gets its own subdirectory named `<spec-file>-<test-title-slug>-<project-name>` (retries append `-retry1`, etc.):

```
test-results/
  login-user-can-log-in-chromium/
    trace.zip
    video.webm
    test-failed-1.png          # screenshot on failure
```

Reference these in a custom report by reading `result.attachments[]` (`{ name, path, contentType }` — `name` is `"trace"`, `"screenshot"`, or `"video"`) from the JSON reporter or Reporter API, rather than hardcoding the path pattern.

Open artifacts:
```bash
npx playwright show-report                       # HTML report (default dir playwright-report/)
npx playwright show-trace test-results/.../trace.zip
```
Or drag-and-drop / URL-paste at https://trace.playwright.dev (fully client-side, no upload).

Docs: https://playwright.dev/docs/trace-viewer · https://playwright.dev/docs/test-use-options

---

## 7. Playwright MCP server (`@playwright/mcp`)

`@playwright/mcp` (current: 0.0.78) is a Model Context Protocol server that exposes browser automation as tools an LLM agent can call directly, rather than a CLI a coding agent shells out to.

- **Mechanism**: operates on the page's **accessibility tree**, not screenshots/pixels — each snapshot is a structured, labeled list of interactive elements (~200–400 tokens) rather than a full DOM dump or vision-model image. Each element gets a stable ref the model can target deterministically (click/type/etc.) without brittle CSS/XPath selectors.
- **Install**: `claude mcp add playwright npx @playwright/mcp@latest` (or standard MCP client config pointing at `npx @playwright/mcp@latest`).
- **vs. plain CLI**: CLI (`npx playwright test`, `codegen`) is invoked by a coding agent as a shell command against a codebase, runs headless by default, and is for generating/running committed test files. MCP is called tool-by-tool by the LLM's own reasoning loop, defaults to headed, and is for live, exploratory, multi-step web interaction / test *authoring* assistance (e.g. "go explore this page and draft a Playwright test for the checkout flow") — it doesn't replace running the actual test suite.
- **Relevance to agent-driven authoring**: useful when an agent needs to *discover* selectors/flows interactively before writing a `.spec.ts` file; not needed for parsing/generating reports from an already-written suite (that's the Reporter/JSON surface above).

Docs: https://playwright.dev/mcp/introduction · https://playwright.dev/docs/getting-started-mcp · https://github.com/microsoft/playwright-mcp

---

## 8. CI / headless Linux setup

```bash
# one-shot: browsers + OS deps (apt packages) in one command
npx playwright install --with-deps
```
- Headless is the default; no Xvfb needed unless deliberately running `--headed` (then wrap with `xvfb-run npx playwright test`).
- Prefer the official Docker image over hand-rolled dependency installs for reproducibility:
  ```bash
  docker run --rm -v $(pwd):/work -w /work \
    mcr.microsoft.com/playwright:v1.61.0-noble \
    npx playwright test
  ```
  (`-noble` = Ubuntu 24.04 base; `-jammy` = Ubuntu 22.04 also published. Pin the tag to your installed `@playwright/test` version.)
- Parallelism: prefer CI-level **sharding** (`--shard=1/4`, distributed across jobs) over cramming workers onto one runner; set `workers: 1` in-job if flake/ordering stability matters more than speed.
- Typical GitHub Actions step:
  ```yaml
  - uses: actions/setup-node@v4
  - run: npm ci
  - run: npx playwright install --with-deps
  - run: npx playwright test --shard=${{ matrix.shard }}/4 --reporter=blob
  - uses: actions/upload-artifact@v4
    with: { name: blob-report-${{ matrix.shard }}, path: blob-report }
  # separate merge job:
  - run: npx playwright merge-reports --reporter html ./all-blob-reports
  ```

Docs: https://playwright.dev/docs/ci · https://playwright.dev/docs/docker

---

## Sources
- [Test CLI](https://playwright.dev/docs/test-cli)
- [Test CLI reference](https://playwright.dev/docs/test-cli-reference)
- [Reporters](https://playwright.dev/docs/test-reporters)
- [Reporter API](https://playwright.dev/docs/test-reporter-api)
- [class-Reporter](https://playwright.dev/docs/api/class-reporter)
- [class-TestCase](https://playwright.dev/docs/api/class-testcase)
- [class-TestResult](https://playwright.dev/docs/api/class-testresult)
- [testReporter.d.ts (source of truth for JSON schema)](https://github.com/microsoft/playwright/blob/main/packages/playwright/types/testReporter.d.ts)
- [json.ts reporter serializer](https://github.com/microsoft/playwright/blob/main/packages/playwright/src/reporters/json.ts)
- [Test annotations & tags](https://playwright.dev/docs/test-annotations)
- [test.step API](https://playwright.dev/docs/api/class-test#test-step)
- [Test fixtures](https://playwright.dev/docs/test-fixtures)
- [Test configuration](https://playwright.dev/docs/test-configuration)
- [class-TestConfig](https://playwright.dev/docs/api/class-testconfig)
- [Test use options (trace/screenshot/video)](https://playwright.dev/docs/test-use-options)
- [Trace viewer](https://playwright.dev/docs/trace-viewer)
- [Playwright MCP introduction](https://playwright.dev/mcp/introduction)
- [Getting started with MCP](https://playwright.dev/docs/getting-started-mcp)
- [playwright-mcp repo](https://github.com/microsoft/playwright-mcp)
- [CI](https://playwright.dev/docs/ci)
- [Docker](https://playwright.dev/docs/docker)
