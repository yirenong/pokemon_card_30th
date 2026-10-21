# Thirty — 30th Celebration collection tracker

Responsive checkbox tracker with list, image-grid, and 3 × 3 views; missing-card clipboard export; and USD/SGD market-value dashboard.

**Hosting details: [VERCEL.md](VERCEL.md).** The shared collection automatically saves through `/api/collection` into Neon Postgres, with password-free login IDs. A deployed Neon Function provides storage when Vercel has no `DATABASE_URL`; no manual Vercel environment setup is needed for this repository. Database credentials stay inside Neon. An explicit server `DATABASE_URL` takes precedence for isolated testing or another database.

## Development and checks

- `npm ci` installs dependencies.
- `npm run build` generates the static HTML and versioned bundle in `dist`.
- `npm run dev` serves the site and backend locally.
- `npm test` runs deterministic feature, catalog, clipboard, pricing, startup, and sync tests.
- `npm run test:db` verifies HTTP, Postgres, and cross-device autosave on an isolated test branch.

The full 196-entry checklist is prerendered into HTML and embedded into the page, so card visibility does not depend on a network request or pricing. Classic Collection images are stored locally and matched to exact product IDs; existing checkbox IDs remain stable. `tests/fixtures/card-catalog-audit.json` records identities and printed numbers. `build-static.cjs` generates a content-hashed script bundle and stylesheet to prevent mixed cached releases.

## Shared collection data

The login IDs shawn, yongtai, sam, and yiren select separate collections. No password is required. API writes update individual cards in a transaction, so unrelated edits do not overwrite each other. The client keeps a durable pending-change queue, retries failed saves, imports a same-domain browser cache only when the database is empty, and shows honest connection/save status. Device layout and currency settings stay in browser storage.

## Market data

- [TCGTracking Open API](https://openapi.tcgtracking.com/): main-set prices at `/v1/3/sets/24722/pricing` and Classic Collection at `/v1/3/sets/24837/pricing`.
- [Frankfurter](https://frankfurter.dev/): `/v2/rate/USD/SGD`.

Use the exact mapped `Holofoil.market` USD quote. Eight Energy entries have no verified listing and remain unpriced, excluded from totals. No runtime prices or exchange rates are embedded. The page checks every 15 minutes while visible; providers publish daily data, not instant sale-by-sale quotes. Update times, partial coverage, stale values, and refresh failures are shown. Valuation counts one copy per checked card and excludes fees, shipping, condition and graded pricing. SGD is a conversion of the US-market estimate, not a local Singapore marketplace quote.

`tests/fixtures` contains catalog and price snapshots only for deterministic tests, not production pricing. Browser visual QA was unavailable; DOM and real-database integration checks passed.

## Rarity filters and bulk ownership

Choose a rarity, then use Check all / Uncheck all to update that entire rarity across sections, searches, and pages. Common, Rare, Double Rare, IR, SIR, Pikachu Rare, Futuristic Rare, Classic Collection, and Energy follow the catalog labels. The controls show owned/total progress, disable when there is nothing to change, and do not alter other rarities. Backend sync batches the full group into one request. `verify-rarity.cjs` covers group isolation, pagination, counters, and queue batching.

## Password-free login IDs

The app now accepts shawn, yongtai, sam, and yiren. Each profile has its own collection and device cache. Enter an ID on the login screen; use Switch account to change profiles. No password is required; anyone who knows an ID can use it. The previous shared collection remains stored separately for legacy clients.

Migration 002 creates the four empty profiles without changing existing selections. Run migrations on the test branch first. Deploy the updated storage Function and the Vercel application together so the API forwards the login ID. The remote adapter rejects services that do not acknowledge the selected ID.

Run the account-isolation test with COLLECTION_TEST_MODE=1 and .env.test.local: node --env-file=.env.test.local verify-accounts.cjs.

## Register a profile

Choose ?Register a login? on the login screen. IDs use 3?24 lowercase letters, numbers, underscores or hyphens. Registration creates a separate empty collection atomically; duplicate IDs are rejected. Enter the same ID on another device to open it. Profiles remain password-free and accessible to anyone who knows the ID. Deploy both the Neon storage Function and frontend/API for registration support; no schema migration is needed.
