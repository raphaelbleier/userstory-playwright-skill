#!/usr/bin/env node
/**
 * npx userstory-playwright-skill init
 *
 * Installs the skill into the current repo, in the native format of every supported agent CLI.
 * The canonical copy lives in .agents/skills/ (read directly by Codex CLI and OpenCode);
 * everything else is either a copy or a three-line pointer at it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = 'user-story-testing';
const CANONICAL = `.agents/skills/${SKILL}`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    force: { type: 'boolean', default: false },
    agents: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const USAGE = `
userstory-playwright-skill init [options]

  --agents <list>   comma-separated: claude,codex,opencode,kilo,copilot  (default: all)
  --force           overwrite files that already exist
  -h, --help        this

Installs into the current directory.
`.trim();

if (values.help || positionals[0] !== 'init') {
  console.log(USAGE);
  process.exit(positionals[0] ? 0 : 2);
}

const ALL_AGENTS = ['claude', 'codex', 'opencode', 'kilo', 'copilot'];
const agents = values.agents
  ? values.agents.split(',').map((a) => a.trim().toLowerCase())
  : ALL_AGENTS;

const unknown = agents.filter((a) => !ALL_AGENTS.includes(a));
if (unknown.length) {
  console.error(`unknown agent(s): ${unknown.join(', ')}\nknown: ${ALL_AGENTS.join(', ')}`);
  process.exit(2);
}

const written = [];
const skipped = [];

function writeFile(dest, contents) {
  if (fs.existsSync(dest) && !values.force) {
    skipped.push(dest);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents);
  written.push(dest);
}

function copyDir(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else writeFile(dest, fs.readFileSync(src));
  }
}

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// --- canonical skill: Codex CLI and OpenCode both scan .agents/skills natively ---
copyDir(path.join(ROOT, 'skill'), CANONICAL);

// --- Claude Code: reads .claude/skills. OpenCode reads this path too, as a fallback. ---
if (agents.includes('claude')) {
  copyDir(path.join(ROOT, 'skill'), `.claude/skills/${SKILL}`);
}

// --- Kilo Code: no SKILL.md support, gets a rule file pointing at the canonical one ---
if (agents.includes('kilo')) {
  writeFile(`.kilocode/rules/${SKILL}.md`, read('adapters/kilocode-rule.md'));
}

// --- GitHub Copilot CLI: custom agent format ---
if (agents.includes('copilot')) {
  writeFile(`.github/agents/${SKILL}.agent.md`, read('adapters/copilot-agent.md'));
}

// --- AGENTS.md: append, never clobber. Codex/OpenCode/Kilo/Copilot all read it. ---
const agentsSection = read('adapters/agents-md-section.md');
if (fs.existsSync('AGENTS.md')) {
  const current = fs.readFileSync('AGENTS.md', 'utf8');
  if (current.includes('## User Story Testing')) {
    skipped.push('AGENTS.md (section already present)');
  } else {
    fs.appendFileSync('AGENTS.md', `\n\n${agentsSection}`);
    written.push('AGENTS.md (appended)');
  }
} else {
  writeFile('AGENTS.md', `# Agent instructions\n\n${agentsSection}`);
}

// --- Playwright scaffolding ---
writeFile('playwright.config.ts', read('templates/playwright.config.ts'));
writeFile('tests/auth.setup.ts', read('templates/auth.setup.ts'));
writeFile('.env.example', read('templates/env.example'));
fs.mkdirSync('tests/stories', { recursive: true });

// --- gitignore: these leak credentials and are pure build output ---
const IGNORES = ['.env', '.auth/', 'test-results/', 'playwright-report/', 'blob-report/'];
const gitignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';
const missing = IGNORES.filter((line) => !gitignore.split('\n').some((l) => l.trim() === line));
if (missing.length) {
  const block = `\n# userstory-playwright-skill\n${missing.join('\n')}\n`;
  fs.appendFileSync('.gitignore', gitignore && !gitignore.endsWith('\n') ? `\n${block}` : block);
  written.push(`.gitignore (+${missing.length} entries)`);
}

// --- report ---
console.log(`\ninstalled user-story-testing for: ${agents.join(', ')}\n`);
for (const f of written) console.log(`  + ${f}`);
if (skipped.length) {
  console.log(`\n  skipped (already exist, pass --force to overwrite):`);
  for (const f of skipped) console.log(`    · ${f}`);
}

console.log(`
next:

  1. npm install -D @playwright/test exceljs
  2. npx playwright install --with-deps chromium
  3. cp .env.example .env     and fill in BASE_URL (+ test credentials if your app has a login)
  4. ask your agent: "generate user stories for this codebase and test them"
`);
