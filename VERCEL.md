# Deploy the collection tracker to Vercel

This version uses a Vercel API and a Neon Postgres database for one shared collection. There is **no app login**. Anyone who can open the deployment can read and change its checkboxes.

## Deploy

1. Import this repository into Vercel. Set **Root Directory** to `.` (leave the field blank for the repository root), **Framework Preset** to **Other**, **Build Command** to `npm run build`, and **Output Directory** to `dist`. The root `vercel.json` already declares these defaults and the `/api/collection` function. Do not use the old `thirty` root-directory setting.
2. No database environment variable is required for the existing collection. The Vercel API forwards validated requests to the deployed Neon Function, which receives its database connection securely from Neon. For isolated Preview deployments, explicitly set `DATABASE_URL` to the separate test database URL from `.env.test.local`; otherwise previews share the real collection.
3. Deploy. Check a card: the status changes from “Saving to backend…” to **“Saved to backend · shared across devices”**. Open the same deployment URL on another device to see your collection. The page checks for other-device changes every 30 seconds and when returning to the page.

The production database and schema have already been provisioned. No migration is needed for this database. Database credentials are server-only: do not add a `NEXT_PUBLIC_`/`VITE_` prefix or put the connection URL in `dist`, JavaScript, or Git.

The database can be viewed in [Neon](https://console.neon.tech/app/projects/old-lake-42721725). Non-secret project/branch details are in `db/project.json`.

**Vercel hosts the application; Neon stores the persistent data.** Redeploying the site does not erase the collection. Do not deploy only `dist`, because that would omit the backend function. The earlier static Sites URL does not provide the new Vercel API.

## Automatic saves and existing selections

- Each checkbox queues an individual change immediately, then automatically saves it to `/api/collection`.
- Different cards edited by different devices are merged in the database; a full stale collection is never used to replace every card. On the same card, the last committed save wins.
- Failed changes remain in a local retry queue. The page retries while open, when the connection returns, or when **Retry saving** is pressed. The status does not report a successful backend save until the server confirms it.
- On an empty database, an existing checklist stored in the same browser and on the **same domain** is seeded once. Later devices load the shared backend state; an old local cache does not overwrite it.
- Browser storage on the old `chatgpt.site` domain cannot be read by a new `vercel.app` domain. Existing checks on that old address are retained there but do not automatically transfer across domains.
- Layout and currency preferences remain local to each device. The owned/missing collection is shared.

## Local development

```sh
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:4173`. The dev server serves the same static assets and API handler used by Vercel. `.env.local` contains the prepared production database credentials; local checkbox edits will therefore affect your real collection. Use `.env.test.local` with the dev server when testing instead:

```sh
node --env-file=.env.test.local scripts/dev.cjs
```

## Use a different database

Copy `.env.example` and fill in a pooled `DATABASE_URL` and direct `DATABASE_URL_UNPOOLED`. Run:

```sh
npm run db:migrate
```

Migrations are idempotent and additive. Use an isolated database branch for migration tests. Configure the new pooled `DATABASE_URL` on Vercel, then redeploy.

## Verification

```sh
npm test
npm run test:db
```

The database integration tests use `.env.test.local`, the separate test branch. They verify actual HTTP requests and real Postgres writes, concurrent edits from two independent clients, persistent unchecks, invalid inputs, and the generated page's checkbox autosave across two independent DOM sessions. Production collection data is not used for test writes.

Source references: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Postgres on Vercel](https://vercel.com/docs/postgres).

## Fix a Vercel 404 after an earlier deployment

The app now lives at the repository root. In Project Settings → Build and Deployment, set Root Directory to `.` (repository root), Framework Preset to Other, Build Command to `npm run build`, and Output Directory to `dist`. Redeploy the latest commit. Without `DATABASE_URL`, the API uses the deployed Neon storage service automatically.

## Storage service

`functions/collection.mjs` runs beside the production database as the Neon Function `collection`. Build its bundle with `node scripts/build-function.cjs`; the generated `.neon/function/index.mjs` is ignored by Git. Deploy an archive containing this file as `index.mjs` to the intended branch. Database connection strings are injected by Neon. The non-secret production service URL lives in `server/remote-store.cjs`. The service is deliberately public because this app uses one shared collection without login; it validates card IDs and boolean ownership values before writing. It supplies no database credentials to callers.

The isolated test Function is on `br-withered-voice-a1czqdex`. `verify-remote.cjs` verifies cross-client saves against that Function when `COLLECTION_TEST_FUNCTION_URL` is set, and refuses production URLs.
