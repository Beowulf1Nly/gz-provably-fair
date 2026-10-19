# Ground Zero provably-fair case openings

Every case opening on the Ground Zero store is decided by a commit-reveal scheme you can check yourself. The server cannot change an outcome after you have seen the commitment, and the odds it uses are the file in this repo.

- `odds.json`: the exact odds table the server uses (generated from its signed configuration; the API serves the same bytes at `GET https://gzapi.groundzerodayz.co/fair/odds`).
- `roll.js`: the roll function. The store API imports this exact file.
- `verify.js`: command line verifier.
- `index.html`: in-browser verifier (Web Crypto, no libraries, nothing is uploaded).
- `test.js`: runs the same test vectors as the server (`npm test`).

Odds file SHA-256 (of the bytes of `odds.json`):

<!-- odds-hash -->
`9dff978c8afe092014c39647a847e883c4d9ad21984338164c1a047938385c2f`
<!-- /odds-hash -->

Every open the server records stores this hash, so you can tell which version of the odds it used. Older versions are in this repo's git history and at `GET /fair/odds/<sha256>` on the API. Changing any odds, item or item order changes the hash.

<!-- odds-table -->
| Case | Items | Legendary | Epic | Rare | Common |
|---|---:|---:|---:|---:|---:|
| Halloween Case (`limited`) | 9 | 26.666 % | 33.334 % | 40.000 % | 0.000 % |
| Black Site Case (`elite`) | 94 | 12.000 % | 38.000 % | 50.000 % | 0.000 % |
| Marksman Case (`marksman`) | 78 | 5.000 % | 20.000 % | 35.000 % | 40.000 % |
| Vanguard Case (`vanguard`) | 107 | 5.000 % | 20.000 % | 35.000 % | 40.000 % |
| Shadow Case (`shadow`) | 86 | 3.833 % | 21.167 % | 35.000 % | 40.000 % |
<!-- /odds-table -->

## How it works

1. **Seeds.** Each player has
   - a **server seed**: 32 random bytes as 64 lowercase hex characters, kept secret by the server;
   - a **server seed hash** `SHA-256(serverSeed)`, shown to you before you open anything (this is the commitment);
   - a **client seed**: text you choose (letters, digits, `_` and `-`, 1 to 64 characters; random 16 hex characters by default);
   - a **nonce**: 0 for your first open with this seed pair, +1 after every open.
2. **Roll.** For an open of case `caseId`:

   ```
   h      = HMAC-SHA256(key = serverSeed, message = clientSeed + ":" + nonce + ":" + caseId)
   n      = the first 13 hex characters of h, read as an integer   (52 bits, 0 .. 2^52 - 1)
   u      = n / 2^52                                               (0 <= u < 1)
   bucket = floor(n * 100000 / 2^52)                               (= floor(u * 100000), 0 .. 99999)
   ```

   `serverSeed`, the message and the hash input are all the **UTF-8 text** as written (the 64-character hex string itself, not the 32 bytes it encodes). `nonce` is written in decimal. The bucket is computed with exact integer arithmetic (`BigInt` in JavaScript), so there is no floating-point rounding.
3. **Item.** In `odds.json` each case lists its items in a fixed order, each with an integer `weight` in thousandths of a percent (1000 = 1 %); the weights of a case add up to exactly 100000. The winner is the first item whose running total of weights is **greater than** the bucket.
   Example: weights 5000, 10000, 85000 give buckets 0-4999, 5000-14999, 15000-99999.
4. **Rotate seed.** Pressing "Change seed" / "Rotate" on the store
   - **reveals** your current server seed (so every open you made with it can now be recomputed by anyone, including this repo's tools),
   - starts a new seed pair with nonce 0, using the client seed you typed (or a random one),
   - the new server seed was already committed: its hash is shown as the "next" seed hash before you choose your client seed, so the server cannot pick it after seeing yours.

   The client seed can only change by rotating. You cannot rotate while an open is still being shown; finish it first.
5. **Records.** Each open stores the case, server seed hash, client seed, nonce, `n`, `u`, the item, the odds-file hash and the time. Your history lists them (`GET /fair/history`, and the store's "Provably fair" page).

Not covered by the roll: the filler items on the spinning reel and the exact stop position inside the winning tile are cosmetic and random; they never decide the result.

For full protection set your own client seed (rotate once) before your first open: the very first seed pair is created by the server.

## Verify an open

You need the (revealed) server seed, client seed, nonce and case id from your history.

**Browser:** open `index.html` (GitHub Pages, or locally), fill in the fields, press Verify. It also checks the seed against the hash you were shown.

**Command line (Node 20+):**

```
node verify.js <serverSeed> <clientSeed> <nonce> <caseId> --hash=<serverSeedHash>
```

Prints the commitment check, HMAC, `n`, `u`, bucket and the item. If the open recorded an older odds hash, fetch that file (`GET /fair/odds/<sha256>`, or this repo's git history) and pass `--odds=<file>`.

**Yourself, in any language:** compute the HMAC-SHA256 above, take 13 hex characters, multiply by 100000, shift right 52 bits, walk the cumulative weights. Anything that disagrees with the store is a bug worth reporting.

Check the odds file itself: `sha256sum odds.json` (or `index.html`, which shows it) must equal the hash above and the `x-odds-sha256` header of `GET /fair/odds`.

## Tests

`npm test` (Node 20+) checks the roll against HMAC/SHA-256 vectors computed outside this code, the item lookup, that every case in `odds.json` adds up to 100000, and that this README states the hash of `odds.json`.

## License

MIT.
