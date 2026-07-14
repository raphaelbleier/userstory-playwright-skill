import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { columnIndex } from '../skill/scripts/lib/schema.mjs';
import { cellText, indexById, loadWorkbook } from '../skill/scripts/lib/workbook.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = path.join(ROOT, 'skill/scripts');

let dir;
let xlsx;

const run = (script, args) =>
  execFileSync('node', [path.join(SCRIPTS, script), ...args], { cwd: dir, encoding: 'utf8' });

/** Warnings go to stderr; execFileSync's return value is stdout only. */
const runStderr = (script, args) =>
  spawnSync('node', [path.join(SCRIPTS, script), ...args], { cwd: dir, encoding: 'utf8' }).stderr;

const STORIES = {
  stories: [
    { id: 'US-001', title: 'Login works', role: 'user', goal: 'log in', benefit: 'access', priority: 'Must' },
    { id: 'US-002', title: 'Contact form validates email', role: 'visitor', goal: 'be warned', benefit: 'reply arrives', priority: 'Should' },
  ],
};

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usps-'));
  xlsx = path.join(dir, 'user-stories.xlsx');
  fs.writeFileSync(path.join(dir, 'stories.json'), JSON.stringify(STORIES));
  run('xlsx-init.mjs', ['--stories', 'stories.json', '--out', 'user-stories.xlsx']);
});

after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('init writes every story, defaulting Status to not-run', () => {
  const { stories } = JSON.parse(run('xlsx-read.mjs', ['--xlsx', 'user-stories.xlsx']));
  assert.equal(stories.length, 2);
  assert.equal(stories[0].id, 'US-001');
  assert.equal(stories[0].title, 'Login works');
  assert.equal(stories[0].status, 'not-run');
});

test('init refuses to clobber an existing sheet', () => {
  assert.throws(
    () => run('xlsx-init.mjs', ['--stories', 'stories.json', '--out', 'user-stories.xlsx']),
    /refusing to overwrite/,
  );
});

test('sync writes results back, keyed by story id', () => {
  const report = {
    suites: [
      {
        specs: [
          {
            tags: ['US-001'],
            file: 'tests/stories/us-001.spec.ts',
            tests: [
              {
                status: 'expected',
                annotations: [{ type: 'story', description: 'US-001' }],
                results: [{ status: 'passed', attachments: [], errors: [] }],
              },
            ],
          },
          {
            tags: ['US-002'],
            file: 'tests/stories/us-002.spec.ts',
            tests: [
              {
                status: 'unexpected',
                annotations: [{ type: 'story', description: 'US-002' }],
                results: [
                  {
                    status: 'failed',
                    error: { message: 'Expected "Please enter a valid email address."' },
                    errors: [],
                    attachments: [{ name: 'trace', path: 'test-results/us-002/trace.zip', contentType: 'application/zip' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report));
  run('xlsx-sync.mjs', ['--xlsx', 'user-stories.xlsx', '--results', 'results.json']);

  const { stories } = JSON.parse(run('xlsx-read.mjs', ['--xlsx', 'user-stories.xlsx']));
  const [a, b] = stories;
  assert.equal(a.status, 'pass');
  assert.equal(a.specFile, 'tests/stories/us-001.spec.ts');
  assert.equal(b.status, 'fail');
  assert.match(b.rootCause, /Please enter a valid email address/);
  assert.equal(b.evidence, 'trace.zip');
});

test('triage overwrites the raw error with a real diagnosis', () => {
  const triage = {
    triage: [
      {
        id: 'US-002',
        severity: 'S2-Critical',
        rootCause: 'isValidEmail only checks for a non-empty string; server never re-validates.',
        status: 'fail',
      },
    ],
  };
  fs.writeFileSync(path.join(dir, 'triage.json'), JSON.stringify(triage));
  run('xlsx-sync.mjs', ['--xlsx', 'user-stories.xlsx', '--triage', 'triage.json']);

  const { stories } = JSON.parse(run('xlsx-read.mjs', ['--xlsx', 'user-stories.xlsx']));
  const us002 = stories.find((s) => s.id === 'US-002');
  assert.equal(us002.severity, 'S2-Critical');
  assert.match(us002.rootCause, /only checks for a non-empty string/);
});

test('a manual edit to a story column survives a sync', async () => {
  // the human reprioritises US-002 and rewrites its title, in Excel
  const { wb, ws } = await loadWorkbook(xlsx);
  const row = indexById(ws).get('US-002');
  row.getCell(columnIndex('priority')).value = 'Must';
  row.getCell(columnIndex('title')).value = 'Contact form MUST validate email (raised by support)';
  await wb.xlsx.writeFile(xlsx);

  run('xlsx-sync.mjs', ['--xlsx', 'user-stories.xlsx', '--results', 'results.json']);

  const { stories } = JSON.parse(run('xlsx-read.mjs', ['--xlsx', 'user-stories.xlsx']));
  const us002 = stories.find((s) => s.id === 'US-002');
  assert.equal(us002.priority, 'Must', 'sync must not touch story-definition columns');
  assert.match(us002.title, /raised by support/);
});

test('a story that turns green has its stale failure data cleared', async () => {
  const report = {
    suites: [
      {
        specs: [
          {
            tags: ['US-002'],
            file: 'tests/stories/us-002.spec.ts',
            tests: [
              {
                status: 'expected',
                annotations: [{ type: 'story', description: 'US-002' }],
                results: [{ status: 'passed', attachments: [], errors: [] }],
              },
            ],
          },
        ],
      },
    ],
  };
  fs.writeFileSync(path.join(dir, 'fixed.json'), JSON.stringify(report));
  run('xlsx-sync.mjs', ['--xlsx', 'user-stories.xlsx', '--results', 'fixed.json']);

  const { stories } = JSON.parse(run('xlsx-read.mjs', ['--xlsx', 'user-stories.xlsx']));
  const us002 = stories.find((s) => s.id === 'US-002');
  assert.equal(us002.status, 'pass');
  assert.equal(us002.rootCause, '', 'a passing story must not still show last run\'s bug');
  assert.equal(us002.severity, '');
});

test('rows are found by id, so reordering in Excel is safe', async () => {
  // the human sorts the sheet so US-002 sits above US-001
  const { wb, ws } = await loadWorkbook(xlsx);
  const rows = indexById(ws);
  const a = rows.get('US-001');
  const b = rows.get('US-002');
  const [aVals, bVals] = [a.values, b.values];
  a.values = bVals;
  b.values = aVals;
  await wb.xlsx.writeFile(xlsx);

  const report = {
    suites: [
      {
        specs: [
          {
            tags: ['US-001'],
            file: 'x.spec.ts',
            tests: [
              {
                status: 'unexpected',
                annotations: [{ type: 'story', description: 'US-001' }],
                results: [{ status: 'failed', error: { message: 'now US-001 is broken' }, errors: [], attachments: [] }],
              },
            ],
          },
        ],
      },
    ],
  };
  fs.writeFileSync(path.join(dir, 'reordered.json'), JSON.stringify(report));
  run('xlsx-sync.mjs', ['--xlsx', 'user-stories.xlsx', '--results', 'reordered.json']);

  const { stories } = JSON.parse(run('xlsx-read.mjs', ['--xlsx', 'user-stories.xlsx']));
  const us001 = stories.find((s) => s.id === 'US-001');
  assert.equal(us001.status, 'fail', 'the swap must not have written the result into the wrong row');
  assert.match(us001.rootCause, /now US-001 is broken/);
});

test('a result for a story that is not in the sheet is ignored, not crashed on', () => {
  const report = {
    suites: [
      {
        specs: [
          {
            tags: ['US-999'],
            file: 'ghost.spec.ts',
            tests: [
              {
                status: 'expected',
                annotations: [{ type: 'story', description: 'US-999' }],
                results: [{ status: 'passed', attachments: [], errors: [] }],
              },
            ],
          },
        ],
      },
    ],
  };
  fs.writeFileSync(path.join(dir, 'ghost.json'), JSON.stringify(report));
  const warning = runStderr('xlsx-sync.mjs', ['--xlsx', 'user-stories.xlsx', '--results', 'ghost.json']);
  assert.match(warning, /unknown story id\(s\).*US-999/s);
});

test('filters read out only the stories asked for', () => {
  const { stories } = JSON.parse(run('xlsx-read.mjs', ['--xlsx', 'user-stories.xlsx', '--id', 'US-001']));
  assert.equal(stories.length, 1);
  assert.equal(stories[0].id, 'US-001');
});
