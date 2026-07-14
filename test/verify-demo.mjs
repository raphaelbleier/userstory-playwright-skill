#!/usr/bin/env node
/**
 * End-to-end proof that the loop works.
 *
 * Runs the real Playwright suite against the demo app, syncs the report into a real
 * xlsx, then asserts the sheet says what it must: three stories green, and the one
 * story covering the planted bug red, with the failure recorded.
 *
 * Needs browsers: npx playwright install chromium
 *
 *   node test/verify-demo.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'fixtures');
const SCRIPTS = path.join(ROOT, 'skill/scripts');
const XLSX = path.join(FIXTURES, 'user-stories.xlsx');
const REPORT = path.join(FIXTURES, 'test-results/results.json');

const script = (name, args) =>
  execFileSync('node', [path.join(SCRIPTS, name), ...args], { cwd: FIXTURES, encoding: 'utf8' });

fs.rmSync(XLSX, { force: true });

console.log('1/4  generate: stories.json -> user-stories.xlsx');
script('xlsx-init.mjs', ['--stories', 'stories.json', '--out', 'user-stories.xlsx']);

console.log('2/4  run: playwright against the demo app');
// Playwright exits non-zero when tests fail. That is the expected outcome here — the demo
// app has a planted bug — so we ignore the exit code and read the report instead.
// No --reporter flag: that would override the config and send JSON to stdout instead of the file.
spawnSync('npx', ['playwright', 'test'], {
  cwd: FIXTURES,
  encoding: 'utf8',
  stdio: ['ignore', 'ignore', 'inherit'],
});
assert.ok(fs.existsSync(REPORT), 'playwright wrote no JSON report');

console.log('3/4  sync: report -> user-stories.xlsx');
script('xlsx-sync.mjs', ['--xlsx', 'user-stories.xlsx', '--results', 'test-results/results.json']);

console.log('4/4  verify: the sheet reports exactly the planted bug');
const { stories } = JSON.parse(script('xlsx-read.mjs', ['--xlsx', 'user-stories.xlsx']));
const byId = Object.fromEntries(stories.map((s) => [s.id, s]));

assert.equal(stories.length, 4, 'expected 4 stories in the sheet');

for (const id of ['US-001', 'US-002', 'US-003']) {
  assert.equal(byId[id].status, 'pass', `${id} should pass against the demo app, got: ${byId[id].status}`);
  assert.equal(byId[id].rootCause, '', `${id} passed, so it must carry no bug text`);
}

const bug = byId['US-004'];
assert.equal(bug.status, 'fail', 'US-004 covers the planted bug and must fail');
assert.match(bug.rootCause, /valid email address/i, 'the failure must be recorded in the sheet');
assert.match(bug.evidence, /trace\.zip/, 'the trace must be linked as evidence');
// note: JSONReportSpec.file is relative to testDir, not to the repo root
assert.equal(bug.specFile, 'stories/us-004.spec.ts');

// The story columns the human owns must be untouched by the run.
assert.equal(bug.priority, 'Should');
assert.equal(bug.title, 'Contact form rejects an invalid email address');

console.log('\nOK — 3 stories green, US-004 red with the bug and its trace recorded.');
