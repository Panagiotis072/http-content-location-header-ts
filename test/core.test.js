import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseContentLocation,
  resolveContentLocation,
  normalizeContentLocation,
} from '../src/index.js';

test('parseContentLocation trims surrounding whitespace', () => {
  assert.equal(parseContentLocation('  /foo/bar  '), '/foo/bar');
});

test('parseContentLocation returns null for empty or whitespace-only input', () => {
  assert.equal(parseContentLocation(''), null);
  assert.equal(parseContentLocation('   '), null);
});

test('parseContentLocation returns null for non-string input', () => {
  assert.equal(parseContentLocation(undefined), null);
  assert.equal(parseContentLocation(null), null);
  assert.equal(parseContentLocation(42), null);
});

test('resolveContentLocation resolves an absolute path against a base', () => {
  assert.equal(
    resolveContentLocation('/foo/bar', 'https://example.test/a/b'),
    'https://example.test/foo/bar'
  );
});

test('resolveContentLocation resolves a relative path against a base', () => {
  assert.equal(
    resolveContentLocation('bar', 'https://example.test/a/b/c'),
    'https://example.test/a/b/bar'
  );
});

test('resolveContentLocation removes dot segments from the reference path', () => {
  assert.equal(
    resolveContentLocation('../bar', 'https://example.test/a/b/c'),
    'https://example.test/a/bar'
  );
  assert.equal(
    resolveContentLocation('./bar', 'https://example.test/a/b/c'),
    'https://example.test/a/b/bar'
  );
});

test('resolveContentLocation keeps the base query when the reference has no query', () => {
  assert.equal(
    resolveContentLocation('', 'https://example.test/a?x=1'),
    'https://example.test/a?x=1'
  );
});

test('resolveContentLocation replaces the base query when the reference has one', () => {
  assert.equal(
    resolveContentLocation('?y=2', 'https://example.test/a?x=1'),
    'https://example.test/a?y=2'
  );
});

test('resolveContentLocation preserves the reference fragment', () => {
  assert.equal(
    resolveContentLocation('/foo#frag', 'https://example.test/a'),
    'https://example.test/foo#frag'
  );
});

test('resolveContentLocation accepts an absolute reference unchanged apart from dot removal', () => {
  assert.equal(
    resolveContentLocation('https://other.test/a/../b', 'https://example.test/base'),
    'https://other.test/b'
  );
});

test('normalizeContentLocation returns null for an empty header', () => {
  assert.equal(normalizeContentLocation('', 'https://example.test/a'), null);
  assert.equal(normalizeContentLocation('   ', 'https://example.test/a'), null);
});

test('normalizeContentLocation resolves a relative header against the base', () => {
  assert.equal(
    normalizeContentLocation('  images/logo.png  ', 'https://example.test/docs/page.html'),
    'https://example.test/docs/images/logo.png'
  );
});

test('normalizeContentLocation throws when the base is not absolute', () => {
  assert.throws(
    () => normalizeContentLocation('/foo', '/relative/base'),
    TypeError
  );
  assert.throws(
    () => normalizeContentLocation('/foo', ''),
    TypeError
  );
});
