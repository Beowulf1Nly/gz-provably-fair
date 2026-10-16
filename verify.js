#!/usr/bin/env node
// Recompute one Ground Zero case open.
//   node verify.js <serverSeed> <clientSeed> <nonce> <caseId> [--hash=<serverSeedHash>] [--odds=<odds.json>]
// serverSeed is revealed when you rotate your seed; clientSeed, nonce and caseId are listed with each open on your history page.
// --hash   also checks the seed against the hash you were shown before opening.
// --odds   odds file to use (default: odds.json next to this script). Use the file whose SHA-256 is recorded on the open.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roll, commit, sha256Hex, message, hmacHex, SCALE } from './roll.js';

const args = process.argv.slice(2), flag = n => args.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3), pos = args.filter(a => !a.startsWith('--'));
if (pos.length !== 4) { console.error('usage: node verify.js <serverSeed> <clientSeed> <nonce> <caseId> [--hash=<serverSeedHash>] [--odds=<odds.json>]'); process.exit(2); }
const [serverSeed, clientSeed, nonceText, caseId] = pos, nonce = Number(nonceText);
if (!Number.isSafeInteger(nonce) || nonce < 0) { console.error('nonce must be a whole number, 0 or more'); process.exit(2); }

const oddsText = readFileSync(flag('odds') || join(dirname(fileURLToPath(import.meta.url)), 'odds.json'), 'utf8'), odds = JSON.parse(oddsText);
const c = odds.cases.find(k => k.id === caseId);
if (!c) { console.error(`unknown case "${caseId}"; cases: ${odds.cases.map(k => k.id).join(', ')}`); process.exit(2); }

const r = roll(serverSeed, clientSeed, nonce, caseId, c.items);
let from = 0;
for (let i = 0; i < r.index; i++) from += c.items[i].weight;
console.log(`odds file sha256   ${sha256Hex(oddsText)}`);
console.log(`server seed hash   ${commit(serverSeed)}`);
console.log(`message            ${message(clientSeed, nonce, caseId)}`);
console.log(`HMAC-SHA256        ${hmacHex(serverSeed, clientSeed, nonce, caseId)}`);
console.log(`n (first 13 hex)   ${r.n}`);
console.log(`u = n / 2^52       ${r.u}`);
console.log(`bucket             ${r.bucket}   (floor(u * ${SCALE}))`);
console.log(`item               #${r.index + 1} ${r.item.name} [${r.item.id}], ${r.item.tier}, bucket range ${from}..${from + r.item.weight - 1}`);
const want = flag('hash');
if (want) {
  const ok = commit(serverSeed) === want.toLowerCase();
  console.log(ok ? 'COMMITMENT OK: this seed hashes to the hash you were shown' : 'COMMITMENT MISMATCH: this seed does NOT hash to the hash you were shown');
  process.exit(ok ? 0 : 1);
}
