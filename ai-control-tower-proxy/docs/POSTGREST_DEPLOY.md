# Enterprise deploy: PostgREST in front of `control-tower` (Azure)

Goal: run the exact same proxy codebase against `GHE-Org-56427446/AIControlTower`,
pointed at the Azure Postgres `control-tower` DB, with **no route/query-builder
code changes** — `server.js`/`routes/**` keep calling `supabaseAdmin.from()` /
`.rpc()` / `.or()` / `.upsert(..., { ignoreDuplicates: true })` exactly as
written today. This works because `@supabase/supabase-js` is a PostgREST
client; pointing it at a self-hosted PostgREST instance instead of Supabase's
hosted one requires no code change, only env vars (see `server.js`'s
`CT_DATA_API_URL` / `CT_DATA_API_SERVICE_KEY`, added for this purpose).

Personal repo (Render) is untouched: it leaves `CT_DATA_API_URL` unset, which
falls back to `SUPABASE_URL` — same behavior as before this change.

## What needs to exist

1. A running PostgREST instance, reachable by the enterprise proxy, configured
   with `PGRST_DB_URI` pointing at `control-tower` on `labgtm-pgt-dev`.
2. A JWT secret PostgREST validates incoming Bearer tokens against.
3. A JWT signed with that secret, `{ "role": "service_role" }`, handed to the
   proxy as `CT_DATA_API_SERVICE_KEY`.

## PostgREST configuration (environment variables)

PostgREST reads `PGRST_*` env vars directly — no config file needed, which
maps cleanly onto an Azure App Service / Container Apps environment-variables
blade:

```
PGRST_DB_URI=postgres://postgres:<password>@labgtm-pgt-dev.postgres.database.azure.com:5432/control-tower
PGRST_DB_SCHEMAS=public
PGRST_DB_ANON_ROLE=authenticated
PGRST_JWT_SECRET=<generate a long random secret, store in Key Vault>
PGRST_DB_USE_LEGACY_GUCS=true
```

Notes:

- `PGRST_DB_URI` uses `postgres` (server superuser) for now, per the
  connectivity-first decision — swap to the dedicated `app_control_tower_proxy`
  role later (tracked separately; see the role-hardening spec). Nothing here
  needs to change when that swap happens except this one connection string.
- `PGRST_DB_ANON_ROLE` is required by PostgREST even though this proxy never
  sends unauthenticated requests (`apiKeyAuth`/`requireAuth` gate everything
  before `supabaseAdmin` is touched) — set it to a role with no table grants
  beyond what `authenticated` already has in the migration spec's RLS setup.
- `PGRST_DB_USE_LEGACY_GUCS=true` is required — the schema's `current_app_user()`
  function (`AGENTS.md` / migration spec Section 9.6) reads
  `request.jwt.claim.sub` as a single legacy per-claim GUC, not the newer
  combined `request.jwt.claims` JSON GUC PostgREST uses by default.

## Minting the service-role JWT

```bash
PGRST_JWT_SECRET=<same secret as above> node scripts/generate-postgrest-service-jwt.js
```

Copy the printed token into the enterprise proxy's `CT_DATA_API_SERVICE_KEY`.
It has no expiry — rotate by changing `PGRST_JWT_SECRET` and reissuing, not by
token expiry.

## Enterprise proxy env vars (AICockpit deploy target)

```
SUPABASE_URL=<unchanged — the real Supabase project's URL, for JWKS/auth only>
CT_DATA_API_URL=https://<postgrest-host>
CT_DATA_API_SERVICE_KEY=<token from the script above>
```

`SUPABASE_SERVICE_ROLE_KEY` is not needed once `CT_DATA_API_SERVICE_KEY` is
set (server.js prefers it), but leaving both is harmless.

## Smoke test before pointing real traffic here

```bash
curl -H "Authorization: Bearer <CT_DATA_API_SERVICE_KEY>" \
  "https://<postgrest-host>/mt_model_pricing?limit=1"
```

Expect a JSON array (possibly empty if `control-tower` has no pricing rows
yet), not a 401/403 or connection error. Then exercise one real `/v1` route
end-to-end against the deployed enterprise proxy before cutting over traffic.

## Open items (not yet decided)

- Where PostgREST itself runs (same App Service as the proxy via a sidecar
  container, a separate small App Service, or Azure Container Apps) — not
  decided. Needs Section 5 of the deploy spec (App Service vs. Container Apps)
  resolved first, since PostgREST ships as a container image and App Service
  would need "Web App for Containers" mode for it specifically, even if the
  Node proxy itself runs on plain App Service.
- Rotation/storage of `PGRST_JWT_SECRET` and the DB password via Key Vault —
  same open item as the role-hardening spec, not resolved here.
