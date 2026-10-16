// Provably-fair roll. Pure functions, no state. This exact file is published unchanged in the public repo gz-provably-fair
// (roll.js) and is the one the store API imports: what the server runs is what anyone can read and re-run.
//
//   commitment   serverSeedHash = SHA-256(serverSeed)                     (hex, input = the 64-char seed text as UTF-8)
//   hash         h = HMAC-SHA256(key = serverSeed, msg = `${clientSeed}:${nonce}:${caseId}`)   (key and msg as UTF-8)
//   number       n = the first 13 hex chars of h as an integer (52 bits), u = n / 2^52, 0 <= u < 1
//   bucket       b = floor(n * 100000 / 2^52) = floor(u * 100000), computed in exact integer arithmetic (BigInt), 0..99999
//   item         the first item, in the published order, whose running total of `weight` is greater than b
// Weights are thousandths of a percent (1 = 0.001 %) and add up to exactly 100000 per case, so there is no rounding anywhere.
import { createHmac, createHash } from 'node:crypto';

export const SCALE = 100000;
export const TWO52 = 2 ** 52;

export const sha256Hex = text => createHash('sha256').update(text, 'utf8').digest('hex');
export const commit = serverSeed => sha256Hex(serverSeed);
export const message = (clientSeed, nonce, caseId) => `${clientSeed}:${nonce}:${caseId}`;
export const hmacHex = (serverSeed, clientSeed, nonce, caseId) => createHmac('sha256', serverSeed).update(message(clientSeed, nonce, caseId), 'utf8').digest('hex');
export const rollInt = (serverSeed, clientSeed, nonce, caseId) => parseInt(hmacHex(serverSeed, clientSeed, nonce, caseId).slice(0, 13), 16);
export const bucketOf = n => Number((BigInt(n) * BigInt(SCALE)) >> 52n);

// items: [{ weight, ... }] in the published order. Index of the first item whose running total of weight is above the bucket.
export function pickIndex(items, bucket) {
  let total = 0;
  for (let index = 0; index < items.length; index++) { total += items[index].weight; if (total > bucket) return index; }
  throw new Error('item weights do not add up to ' + SCALE);
}

// Returns { n, u, bucket, index, item }.
export function roll(serverSeed, clientSeed, nonce, caseId, items) {
  const n = rollInt(serverSeed, clientSeed, nonce, caseId), bucket = bucketOf(n), index = pickIndex(items, bucket);
  return { n, u: n / TWO52, bucket, index, item: items[index] };
}
