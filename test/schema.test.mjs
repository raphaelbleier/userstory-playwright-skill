import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStories, COLUMNS, columnIndex } from '../skill/scripts/lib/schema.mjs';

const ok = { id: 'US-001', title: 'A story' };

test('accepts a minimal valid story', () => {
  assert.doesNotThrow(() => validateStories([ok]));
});

test('rejects a malformed id', () => {
  assert.throws(() => validateStories([{ ...ok, id: '1' }]), /must match US-NNN/);
  assert.throws(() => validateStories([{ ...ok, id: 'us-001' }]), /must match US-NNN/);
});

test('rejects duplicate ids, because the id is the join key', () => {
  assert.throws(() => validateStories([ok, { ...ok, title: 'Another' }]), /duplicate story id: US-001/);
});

test('rejects a story with no title', () => {
  assert.throws(() => validateStories([{ id: 'US-001' }]), /title is required/);
});

test('rejects values outside the dropdowns', () => {
  assert.throws(() => validateStories([{ ...ok, priority: 'Urgent' }]), /priority must be one of/);
  assert.throws(() => validateStories([{ ...ok, status: 'broken' }]), /status must be one of/);
  assert.throws(() => validateStories([{ ...ok, severity: 'S9' }]), /severity must be one of/);
});

test('rejects an empty story list', () => {
  assert.throws(() => validateStories([]), /non-empty array/);
});

test('columnIndex is 1-based and matches the column order', () => {
  assert.equal(columnIndex('id'), 1);
  assert.equal(columnIndex('evidence'), COLUMNS.length);
});
