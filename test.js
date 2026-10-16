// node --test
// Runs the vectors the store API's own tests use (HMAC/SHA-256 values computed independently with .NET), and checks odds.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { roll, rollInt, bucketOf, commit, hmacHex, SCALE } from './roll.js';

const read = f => readFileSync(new URL(f, import.meta.url), 'utf8');
const oddsText = read('./odds.json'), odds = JSON.parse(oddsText);
const SEED = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const VECTORS = [
  { client: 'abc123', nonce: 0, caseId: 'shadow', hmac: 'f72ec1b876ba4d3a0c85ad8fdc6d4de17094484fbaefa65a6fca9f39189d6680', n: 4348483050367908, bucket: 96555 },
  { client: 'abc123', nonce: 0, caseId: 'main', hmac: '895a2b36f24d1148c46b023d56d74551f5e731fa3ba0b450f1ab2ab03109b7fa', n: 2416325841331409, bucket: 53653 },
  { client: 'abc123', nonce: 1, caseId: 'main', hmac: 'd149a6cf6bc3ad7de532ff44fdf67416c3c3aeab6e218f50ff1b6322acbbc70f', n: 3681828182867002, bucket: 81753 },
  { client: 'player-seed_9', nonce: 7, caseId: 'elite', hmac: '21229cf7da8d3248dd0a76128f85785956be30bfdb6b179f19ff3fcdde66d620', n: 582920737499347, bucket: 12943 }
];

test('commitment and HMAC vectors', () => {
  assert.equal(commit(SEED), '2a8abfa8cb9906290437854193ca6bca41d4d4e26d1d454bd66a35158095e737');
  for (const v of VECTORS) {
    assert.equal(hmacHex(SEED, v.client, v.nonce, v.caseId), v.hmac);
    assert.equal(rollInt(SEED, v.client, v.nonce, v.caseId), v.n);
    assert.equal(bucketOf(v.n), v.bucket);
  }
});

test('the winner is the first item whose running total is above the bucket', () => {
  for (const v of VECTORS) {
    const c = odds.cases.find(k => k.id === v.caseId);
    if (!c) continue;                                          // "main" is only a test case of the API's suite
    let total = 0, want = null;
    for (const it of c.items) { total += it.weight; if (total > v.bucket) { want = it; break; } }
    assert.equal(roll(SEED, v.client, v.nonce, v.caseId, c.items).item.id, want.id);
  }
});

test('odds.json: every case adds up to exactly 100000 and has unique items', () => {
  assert.equal(odds.scale, SCALE);
  for (const c of odds.cases) {
    assert.equal(c.items.reduce((s, i) => s + i.weight, 0), SCALE, c.id);
    assert.ok(c.items.every(i => Number.isInteger(i.weight) && i.weight > 0), c.id);
    assert.equal(new Set(c.items.map(i => i.id)).size, c.items.length, c.id);
  }
});

test('README states the SHA-256 of odds.json', () => {
  assert.ok(read('./README.md').includes(createHash('sha256').update(oddsText, 'utf8').digest('hex')));
});

test('odds.json is one line without a trailing newline (nothing for line-ending conversion to change)', () => {
  assert.ok(!oddsText.includes('\n') && !oddsText.includes('\r'));
});
