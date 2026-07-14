import { TEST_STATUS_MAP } from './schema.mjs';

const ANSI = /\x1b\[[0-9;]*m/g;

/** Worst-wins, so a story that passes in chromium but fails in webkit is a fail. */
const SEVERITY_ORDER = ['skipped', 'pass', 'flaky', 'fail'];
const worst = (a, b) =>
  SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;

function* walkSpecs(suites = []) {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) yield spec;
    yield* walkSpecs(suite.suites);
  }
}

/**
 * The story ID lives in two places. The annotation is the reliable one: it is typed
 * and survives verbatim. The tag is the fallback — note Playwright strips the '@'
 * before it reaches the JSON, so we match bare 'US-001', not '@US-001'.
 */
const STORY_ID_RE = /^US-\d{3,}$/;

function storyIdOf(spec) {
  for (const test of spec.tests ?? []) {
    const a = (test.annotations ?? []).find((x) => x.type === 'story' && x.description);
    if (a) return a.description.trim();
  }
  const tag = (spec.tags ?? []).find((t) => STORY_ID_RE.test(t));
  return tag ?? null;
}

/** Last attempt is the outcome that counts; earlier ones are retries. */
const lastResult = (test) => (test.results ?? [])[(test.results?.length ?? 1) - 1];

function evidenceOf(test) {
  const result = lastResult(test);
  const attachments = result?.attachments ?? [];
  for (const want of ['trace', 'screenshot', 'video']) {
    const hit = attachments.find((a) => a.name === want && a.path);
    if (hit) return hit.path;
  }
  return '';
}

function errorOf(test) {
  const result = lastResult(test);
  const message = result?.error?.message ?? result?.errors?.[0]?.message ?? '';
  return message.replace(ANSI, '').trim();
}

/**
 * Playwright JSON report -> one record per story ID.
 *
 * A spec produces one `tests[]` entry per project in the matrix. We fold them into a
 * single row because the sheet has one row per story, not per story-per-browser.
 */
export function parseReport(report) {
  const byStory = new Map();

  for (const spec of walkSpecs(report.suites)) {
    const id = storyIdOf(spec);
    if (!id) continue;

    for (const test of spec.tests ?? []) {
      const status = TEST_STATUS_MAP[test.status];
      if (!status) continue;

      const existing = byStory.get(id);
      const record = {
        id,
        status,
        specFile: spec.file ?? '',
        evidence: evidenceOf(test),
        error: errorOf(test),
      };

      if (!existing) {
        byStory.set(id, record);
        continue;
      }

      const merged = worst(existing.status, status);
      byStory.set(id, {
        ...existing,
        status: merged,
        // keep the evidence and error belonging to whichever run actually failed
        evidence: merged === status ? record.evidence || existing.evidence : existing.evidence,
        error: merged === status ? record.error || existing.error : existing.error,
      });
    }
  }

  return [...byStory.values()];
}

/** Stories present in the sheet but absent from the report — usually a missing spec. */
export function missingStories(sheetIds, results) {
  const ran = new Set(results.map((r) => r.id));
  return sheetIds.filter((id) => !ran.has(id));
}
