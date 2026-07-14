#!/usr/bin/env node
/**
 * Write results back into an existing user-stories.xlsx, keyed by story ID.
 *
 *   node xlsx-sync.mjs --xlsx user-stories.xlsx --results test-results/results.json
 *   node xlsx-sync.mjs --xlsx user-stories.xlsx --triage triage.json
 *
 * --results  Playwright JSON report. Writes Spec File, Status, Evidence, and the raw
 *            error into Bug / Root Cause.
 * --triage   Agent diagnosis: [{ id, severity, rootCause, status? }]. Overwrites the
 *            raw error with a human-grade explanation.
 *
 * Story-definition columns (ID..Source Files) are never touched. Rows are located by
 * ID, so reordering, filtering or deleting rows in Excel is safe.
 */
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { SEVERITIES, STATUSES, columnIndex } from './lib/schema.mjs';
import { applyStyles, cellText, indexById, loadWorkbook, setEvidence, setStatus } from './lib/workbook.mjs';
import { missingStories, parseReport } from './lib/report.mjs';

const { values } = parseArgs({
  options: {
    xlsx: { type: 'string', default: 'user-stories.xlsx' },
    results: { type: 'string' },
    triage: { type: 'string' },
  },
});

if (!values.results && !values.triage) {
  console.error('usage: xlsx-sync.mjs --xlsx <file> (--results <report.json> | --triage <triage.json>)');
  process.exit(2);
}

const { wb, ws } = await loadWorkbook(values.xlsx);
const rows = indexById(ws);
const unknown = [];
let touched = 0;

if (values.results) {
  const report = JSON.parse(fs.readFileSync(values.results, 'utf8'));
  const results = parseReport(report);

  for (const r of results) {
    const row = rows.get(r.id);
    if (!row) {
      unknown.push(r.id);
      continue;
    }
    if (r.specFile) row.getCell(columnIndex('specFile')).value = r.specFile;
    setStatus(row, r.status);
    setEvidence(row, r.evidence);

    const rootCause = row.getCell(columnIndex('rootCause'));
    const severity = row.getCell(columnIndex('severity'));
    if (r.status === 'fail' || r.status === 'flaky') {
      // raw error is a placeholder — `--triage` replaces it with a real diagnosis
      rootCause.value = r.error || '(no error message in report)';
    } else {
      // story is green: clear stale failure data from a previous run
      rootCause.value = '';
      severity.value = '';
    }
    touched++;
  }

  const absent = missingStories([...rows.keys()], results);
  for (const id of absent) {
    const row = rows.get(id);
    if (cellText(row.getCell(columnIndex('status'))) === 'not-run') continue;
    // it ran before and didn't this time — don't silently keep a stale pass
    setStatus(row, 'not-run');
  }
  if (absent.length) {
    console.warn(`${absent.length} story/stories had no matching test: ${absent.join(', ')}`);
  }
}

if (values.triage) {
  const raw = JSON.parse(fs.readFileSync(values.triage, 'utf8'));
  const entries = Array.isArray(raw) ? raw : raw.triage;

  for (const t of entries) {
    const row = rows.get(t.id);
    if (!row) {
      unknown.push(t.id);
      continue;
    }
    if (t.severity) {
      if (!SEVERITIES.includes(t.severity)) {
        throw new Error(`${t.id}: severity must be one of ${SEVERITIES.join('|')}, got: ${t.severity}`);
      }
      row.getCell(columnIndex('severity')).value = t.severity;
    }
    if (t.rootCause) row.getCell(columnIndex('rootCause')).value = t.rootCause;
    if (t.status) {
      if (!STATUSES.includes(t.status)) {
        throw new Error(`${t.id}: status must be one of ${STATUSES.join('|')}, got: ${t.status}`);
      }
      setStatus(row, t.status);
    }
    touched++;
  }
}

if (unknown.length) {
  console.warn(`ignored ${unknown.length} unknown story id(s) not present in the sheet: ${unknown.join(', ')}`);
}

applyStyles(ws);
await wb.xlsx.writeFile(values.xlsx);
console.log(`updated ${touched} row(s) in ${values.xlsx}`);
