/**
 * Single source of truth for the user-story sheet.
 *
 * Column order here defines column order in the xlsx. Everything else
 * (init, read, sync, validation) derives from this array.
 */

export const SHEET_NAME = 'Stories';

export const PRIORITIES = ['Must', 'Should', 'Could', 'Wont'];
export const STATUSES = ['not-run', 'pass', 'fail', 'flaky', 'skipped', 'blocked'];
export const SEVERITIES = ['S1-Blocker', 'S2-Critical', 'S3-Major', 'S4-Minor', 'S5-Trivial'];

/**
 * owner:
 *   'story'  — authored during `generate`, never touched again by tooling
 *   'run'    — written by xlsx-sync --results
 *   'triage' — written by xlsx-sync --triage
 */
export const COLUMNS = [
  { key: 'id', header: 'ID', width: 10, owner: 'story' },
  { key: 'title', header: 'Title', width: 42, owner: 'story' },
  { key: 'role', header: 'Role', width: 16, owner: 'story' },
  { key: 'goal', header: 'Goal', width: 38, owner: 'story' },
  { key: 'benefit', header: 'Benefit', width: 34, owner: 'story' },
  { key: 'priority', header: 'Priority', width: 10, owner: 'story', list: PRIORITIES },
  { key: 'acceptanceCriteria', header: 'Acceptance Criteria', width: 52, owner: 'story', wrap: true },
  { key: 'preconditions', header: 'Preconditions', width: 26, owner: 'story', wrap: true },
  { key: 'requiresAuth', header: 'Requires Auth', width: 13, owner: 'story', list: ['yes', 'no'] },
  { key: 'sourceFiles', header: 'Source Files', width: 34, owner: 'story', wrap: true },
  { key: 'specFile', header: 'Spec File', width: 30, owner: 'run' },
  { key: 'status', header: 'Status', width: 11, owner: 'run', list: STATUSES },
  { key: 'severity', header: 'Severity', width: 13, owner: 'triage', list: SEVERITIES },
  { key: 'rootCause', header: 'Bug / Root Cause', width: 52, owner: 'triage', wrap: true },
  { key: 'evidence', header: 'Evidence', width: 30, owner: 'run' },
];

export const columnIndex = (key) => COLUMNS.findIndex((c) => c.key === key) + 1;

/** Playwright JSONReportTest.status -> our sheet Status. */
export const TEST_STATUS_MAP = {
  expected: 'pass',
  unexpected: 'fail',
  flaky: 'flaky',
  skipped: 'skipped',
};

const ID_RE = /^US-\d{3,}$/;

/** Throws on anything that would produce a corrupt or unjoinable sheet. */
export function validateStories(stories) {
  if (!Array.isArray(stories) || stories.length === 0) {
    throw new Error('stories must be a non-empty array');
  }
  const seen = new Set();
  for (const [i, s] of stories.entries()) {
    if (!ID_RE.test(s.id ?? '')) {
      throw new Error(`stories[${i}].id must match US-NNN, got: ${JSON.stringify(s.id)}`);
    }
    if (seen.has(s.id)) throw new Error(`duplicate story id: ${s.id}`);
    seen.add(s.id);

    if (!s.title) throw new Error(`${s.id}: title is required`);
    if (s.priority && !PRIORITIES.includes(s.priority)) {
      throw new Error(`${s.id}: priority must be one of ${PRIORITIES.join('|')}, got: ${s.priority}`);
    }
    if (s.status && !STATUSES.includes(s.status)) {
      throw new Error(`${s.id}: status must be one of ${STATUSES.join('|')}, got: ${s.status}`);
    }
    if (s.severity && !SEVERITIES.includes(s.severity)) {
      throw new Error(`${s.id}: severity must be one of ${SEVERITIES.join('|')}, got: ${s.severity}`);
    }
  }
  return stories;
}
