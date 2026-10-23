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

// Reroll (trade-up) of skins of `tier`, same seeds and nonce counter as opens:
//   hash         h = HMAC-SHA256(key = serverSeed, msg = `${clientSeed}:${nonce}:reroll-${tier}`)
//   tier         b = bucket of the first 13 hex chars (as above); b < upWeight = a skin of the next tier up, else one of the same tier
//   skin         n2 = the next 13 hex chars (14th to 26th) as an integer, index = floor(n2 * count / 2^52) in exact integer arithmetic,
//                into that tier's published pool (reroll-odds.json, in its order) without the skins the player already owns (listed in the record)
// Returns { n, n2, u, bucket, up, index }.
//
// Same-family reroll (reroll-odds format 2, Hunter 2026-10-23): before the skin, the result's family (knife, sniper, rifle...) is picked:
//   up           decided by the bucket of n exactly as above (it does not depend on the family)
//   weights      how many of the inputs are in each family, families in the published order, only families with skins at the result tier
//   family       n3 = the 27th to 39th hex chars as an integer, x = floor(n3 * total weight / 2^52) in exact integer arithmetic,
//                the first family whose running total of weight is greater than x
//   skin         index = floor(n2 * count / 2^52) into that family's pool at the result tier (rerollRoll with that family's counts)
// Returns { n3, index } (index into weights).
export function familyPick(serverSeed, clientSeed, nonce, tier, weights) {
  const h = hmacHex(serverSeed, clientSeed, nonce, 'reroll-' + tier), n3 = parseInt(h.slice(26, 39), 16);
  const total = weights.reduce((a, w) => a + w, 0), x = Number((BigInt(n3) * BigInt(total)) >> 52n);
  let run = 0;
  for (let index = 0; index < weights.length; index++) { run += weights[index]; if (run > x) return { n3, index }; }
  throw new Error('no family weight');
}
export function rerollRoll(serverSeed, clientSeed, nonce, tier, upWeight, upCount, sameCount) {
  const h = hmacHex(serverSeed, clientSeed, nonce, 'reroll-' + tier), n = parseInt(h.slice(0, 13), 16), n2 = parseInt(h.slice(13, 26), 16);
  const bucket = bucketOf(n), up = bucket < upWeight, count = up ? upCount : sameCount;
  return { n, n2, u: n / TWO52, bucket, up, index: Number((BigInt(n2) * BigInt(count)) >> 52n) };
}
