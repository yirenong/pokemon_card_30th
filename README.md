# Thirty — 30th Celebration collection tracker

Responsive checkbox tracker with list, image-grid, and 3 × 3 views; missing-card clipboard export; and USD/SGD market-value dashboard.

**Vercel backend setup: [VERCEL.md](VERCEL.md).** The shared collection now automatically saves through `/api/collection` into Neon Postgres, with no app login. The production schema has already been provisioned. The included `.env.local` is ignored and contains the server connection string you must add to Vercel.

## Development and checks

- `npm ci` installs dependencies.
- `npm run build` generates the static HTML and versioned bundle in `dist`.
- `npm run dev` serves the site and backend locally.
- `npm test` runs deterministic feature, catalog, clipboard, pricing, startup, and sync tests.
- `npm run test:db` verifies HTTP, Postgres, and cross-device autosave on an isolated test branch.

The full 196-entry checklist is prerendered into HTML and embedded into the page, so card visibility does not depend on a network request or pricing. Classic Collection images are stored locally and matched to exact product IDs; existing checkbox IDs remain stable. `tests/fixtures/card-catalog-audit.json` records identities and printed numbers. `build-static.cjs` generates a content-hashed script bundle and stylesheet to prevent mixed cached releases.

## Shared collection data

No login is required. This is one shared collection: everyone opening the deployment can edit it. API writes update individual cards in a transaction, so unrelated edits do not overwrite each other. The client keeps a durable pending-change queue, retries failed saves, imports a same-domain browser cache only when the database is empty, and shows honest connection/save status. Device layout and currency settings stay in browser storage.

## Market data

- [TCGTracking Open API](https://openapi.tcgtracking.com/): main-set prices at `/v1/3/sets/24722/pricing` and Classic Collection at `/v1/3/sets/24837/pricing`.
- [Frankfurter](https://frankfurter.dev/): `/v2/rate/USD/SGD`.

Use the exact mapped `Holofoil.market` USD quote. Eight Energy entries have no verified listing and remain unpriced, excluded from totals. No runtime prices or exchange rates are embedded. The page checks every 15 minutes while visible; providers publish daily data, not instant sale-by-sale quotes. Update times, partial coverage, stale values, and refresh failures are shown. Valuation counts one copy per checked card and excludes fees, shipping, condition and graded pricing. SGD is a conversion of the US-market estimate, not a local Singapore marketplace quote.

`tests/fixtures` contains catalog and price snapshots only for deterministic tests, not production pricing. Browser visual QA was unavailable; DOM and real-database integration checks passed.
