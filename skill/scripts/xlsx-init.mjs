#!/usr/bin/env node
/**
 * stories.json -> user-stories.xlsx
 *
 *   node xlsx-init.mjs --stories stories.json --out user-stories.xlsx [--force]
 *
 * Refuses to clobber an existing sheet unless --force. The sheet is the user's
 * working document; overwriting it silently would throw away manual edits.
 */
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { validateStories } from './lib/schema.mjs';
import { createWorkbook } from './lib/workbook.mjs';

const { values } = parseArgs({
  options: {
    stories: { type: 'string' },
    out: { type: 'string', default: 'user-stories.xlsx' },
    force: { type: 'boolean', default: false },
  },
});

if (!values.stories) {
  console.error('usage: xlsx-init.mjs --stories <stories.json> [--out user-stories.xlsx] [--force]');
  process.exit(2);
}

if (fs.existsSync(values.out) && !values.force) {
  console.error(
    `refusing to overwrite ${values.out} (it may contain manual edits).\n` +
      `pass --force to replace it, or delete it first.`,
  );
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(values.stories, 'utf8'));
const stories = validateStories(Array.isArray(raw) ? raw : raw.stories);

const wb = createWorkbook(stories);
await wb.xlsx.writeFile(values.out);

console.log(`wrote ${stories.length} stories to ${values.out}`);
