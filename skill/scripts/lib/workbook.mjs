import ExcelJS from 'exceljs';
import { COLUMNS, SHEET_NAME, STATUSES, columnIndex } from './schema.mjs';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

/** Status -> [fill, font] so a reader can triage the sheet at a glance. */
const STATUS_STYLE = {
  pass: ['FFD1FAE5', 'FF065F46'],
  fail: ['FFFEE2E2', 'FF991B1B'],
  flaky: ['FFFEF3C7', 'FF92400E'],
  blocked: ['FFE5E7EB', 'FF374151'],
  skipped: ['FFF3F4F6', 'FF6B7280'],
  'not-run': ['FFFFFFFF', 'FF9CA3AF'],
};

export function createWorkbook(stories) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'userstory-playwright-skill';
  wb.created = new Date();

  const ws = wb.addWorksheet(SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.columns = COLUMNS.map((c) => ({ key: c.key, header: c.header, width: c.width }));

  const header = ws.getRow(1);
  header.font = HEADER_FONT;
  header.fill = HEADER_FILL;
  header.alignment = { vertical: 'middle' };
  header.height = 22;

  for (const s of stories) {
    ws.addRow({
      ...s,
      requiresAuth: s.requiresAuth === true || s.requiresAuth === 'yes' ? 'yes' : 'no',
      status: s.status ?? 'not-run',
    });
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
  applyStyles(ws);
  return wb;
}

/**
 * Dropdowns, wrapping and status colours. Safe to re-run on a loaded workbook —
 * it only rewrites presentation, never cell values.
 */
export function applyStyles(ws) {
  const lastRow = Math.max(ws.rowCount, 2);

  for (const col of COLUMNS) {
    const idx = columnIndex(col.key);
    for (let r = 2; r <= lastRow; r++) {
      const cell = ws.getCell(r, idx);
      if (col.wrap) cell.alignment = { wrapText: true, vertical: 'top' };
      if (col.list) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${col.list.join(',')}"`],
        };
      }
    }
  }

  const statusIdx = columnIndex('status');
  for (let r = 2; r <= lastRow; r++) {
    const cell = ws.getCell(r, statusIdx);
    const style = STATUS_STYLE[String(cell.value ?? '')];
    if (!style) continue;
    const [bg, fg] = style;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.font = { color: { argb: fg }, bold: true };
    cell.alignment = { horizontal: 'center' };
  }
}

export async function loadWorkbook(path) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) throw new Error(`worksheet "${SHEET_NAME}" not found in ${path}`);
  return { wb, ws };
}

/** Cell value -> plain string. exceljs hands back objects for hyperlinks and rich text. */
export function cellText(cell) {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if ('text' in v) return String(v.text);
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return String(v.result ?? '');
  }
  return String(v);
}

export function readStories(ws) {
  const out = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const story = {};
    for (const col of COLUMNS) story[col.key] = cellText(row.getCell(columnIndex(col.key)));
    if (!story.id) return;
    out.push(story);
  });
  return out;
}

/** Row lookup by story ID, so patches survive the user reordering or deleting rows. */
export function indexById(ws) {
  const map = new Map();
  const idIdx = columnIndex('id');
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const id = cellText(row.getCell(idIdx)).trim();
    if (id) map.set(id, row);
  });
  return map;
}

export function setStatus(row, status) {
  if (!STATUSES.includes(status)) throw new Error(`unknown status: ${status}`);
  row.getCell(columnIndex('status')).value = status;
}

export function setEvidence(row, path) {
  const cell = row.getCell(columnIndex('evidence'));
  if (!path) {
    cell.value = '';
    return;
  }
  cell.value = { text: path.split('/').pop(), hyperlink: path };
  cell.font = { color: { argb: 'FF2563EB' }, underline: true };
}
