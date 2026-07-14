import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReport, missingStories } from '../skill/scripts/lib/report.mjs';

const spec = (overrides = {}) => ({
  title: 'US-001: something',
  tags: ['US-001'],
  file: 'tests/stories/us-001.spec.ts',
  tests: [
    {
      status: 'expected',
      annotations: [{ type: 'story', description: 'US-001' }],
      results: [{ status: 'passed', duration: 10, attachments: [], errors: [] }],
    },
  ],
  ...overrides,
});

test('maps Playwright test-level status to sheet status', () => {
  const report = {
    suites: [
      {
        specs: [
          spec(),
          spec({
            tags: ['US-002'],
            tests: [
              {
                status: 'unexpected',
                annotations: [{ type: 'story', description: 'US-002' }],
                results: [{ status: 'failed', errors: [], attachments: [], error: { message: 'boom' } }],
              },
            ],
          }),
          spec({
            tags: ['US-003'],
            tests: [
              {
                status: 'flaky',
                annotations: [{ type: 'story', description: 'US-003' }],
                results: [{ status: 'passed', errors: [], attachments: [] }],
              },
            ],
          }),
        ],
      },
    ],
  };

  const byId = Object.fromEntries(parseReport(report).map((r) => [r.id, r.status]));
  assert.deepEqual(byId, { 'US-001': 'pass', 'US-002': 'fail', 'US-003': 'flaky' });
});

test('finds specs inside nested describe blocks', () => {
  const report = { suites: [{ specs: [], suites: [{ specs: [spec()] }] }] };
  assert.equal(parseReport(report).length, 1);
});

test('falls back to the tag when the annotation is missing', () => {
  const report = {
    suites: [{ specs: [spec({ tests: [{ status: 'expected', annotations: [], results: [{ status: 'passed' }] }] })] }],
  };
  assert.equal(parseReport(report)[0].id, 'US-001');
});

test('ignores specs that carry no story id at all', () => {
  const report = {
    suites: [
      { specs: [spec({ tags: ['smoke'], tests: [{ status: 'expected', annotations: [], results: [{ status: 'passed' }] }] })] },
    ],
  };
  assert.deepEqual(parseReport(report), []);
});

test('a story that passes in one project and fails in another is a fail', () => {
  const report = {
    suites: [
      {
        specs: [
          spec({
            tests: [
              {
                status: 'expected',
                annotations: [{ type: 'story', description: 'US-001' }],
                results: [{ status: 'passed', attachments: [], errors: [] }],
              },
              {
                status: 'unexpected',
                annotations: [{ type: 'story', description: 'US-001' }],
                results: [
                  {
                    status: 'failed',
                    error: { message: 'webkit blew up' },
                    errors: [],
                    attachments: [{ name: 'trace', path: 'test-results/x/trace.zip', contentType: 'application/zip' }],
                  },
                ],
              },
            ],
          }),
        ],
      },
    ],
  };

  const [result] = parseReport(report);
  assert.equal(result.status, 'fail');
  // the evidence must come from the run that actually failed, not the one that passed
  assert.equal(result.evidence, 'test-results/x/trace.zip');
  assert.equal(result.error, 'webkit blew up');
});

test('reads the last attempt, not the first, so a retry decides the outcome', () => {
  const report = {
    suites: [
      {
        specs: [
          spec({
            tests: [
              {
                status: 'flaky',
                annotations: [{ type: 'story', description: 'US-001' }],
                results: [
                  { status: 'failed', retry: 0, error: { message: 'first attempt' }, attachments: [], errors: [] },
                  { status: 'passed', retry: 1, attachments: [], errors: [] },
                ],
              },
            ],
          }),
        ],
      },
    ],
  };
  assert.equal(parseReport(report)[0].error, '');
});

test('strips ANSI colour codes from error messages', () => {
  const report = {
    suites: [
      {
        specs: [
          spec({
            tests: [
              {
                status: 'unexpected',
                annotations: [{ type: 'story', description: 'US-001' }],
                results: [{ status: 'failed', error: { message: '\x1b[31mExpected\x1b[0m /dashboard' }, errors: [], attachments: [] }],
              },
            ],
          }),
        ],
      },
    ],
  };
  assert.equal(parseReport(report)[0].error, 'Expected /dashboard');
});

test('prefers a trace attachment over a screenshot', () => {
  const report = {
    suites: [
      {
        specs: [
          spec({
            tests: [
              {
                status: 'unexpected',
                annotations: [{ type: 'story', description: 'US-001' }],
                results: [
                  {
                    status: 'failed',
                    errors: [],
                    attachments: [
                      { name: 'screenshot', path: 'a.png', contentType: 'image/png' },
                      { name: 'trace', path: 'b.zip', contentType: 'application/zip' },
                    ],
                  },
                ],
              },
            ],
          }),
        ],
      },
    ],
  };
  assert.equal(parseReport(report)[0].evidence, 'b.zip');
});

test('reports sheet stories that no test covered', () => {
  const results = [{ id: 'US-001' }];
  assert.deepEqual(missingStories(['US-001', 'US-002'], results), ['US-002']);
});
