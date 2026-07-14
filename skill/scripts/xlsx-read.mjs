#!/usr/bin/env node
/**
 * user-stories.xlsx -> JSON on stdout, so the agent can read the sheet the user edited.
 *
 *   node xlsx-read.mjs --xlsx user-stories.xlsx
 *   node xlsx-read.mjs --xlsx user-stories.xlsx --status not-run,fail
 *   node xlsx-read.mjs --xlsx user-stories.xlsx --id US-001
 */
import { parseArgs } from 'node:util';
import { loadWorkbook, readStories } from './lib/workbook.mjs';

const { values } = parseArgs({
  options: {
    xlsx: { type: 'string', default: 'user-stories.xlsx' },
    status: { type: 'string' },
    id: { type: 'string' },
  },
});

const { ws } = await loadWorkbook(values.xlsx);
let stories = readStories(ws);

if (values.status) {
  const wanted = new Set(values.status.split(',').map((s) => s.trim()));
  stories = stories.filter((s) => wanted.has(s.status || 'not-run'));
}
if (values.id) {
  const wanted = new Set(values.id.split(',').map((s) => s.trim()));
  stories = stories.filter((s) => wanted.has(s.id));
}

process.stdout.write(JSON.stringify({ stories }, null, 2) + '\n');
