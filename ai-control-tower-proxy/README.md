# AI Control Tower Proxy

Standalone backend for the AI Control Tower Settings API AND the Ingestion API
(`/v1/*`). This proxy is separate from Product Studio and does not import or
modify Product Studio source files — the `/v1` route/middleware/lib code was
ported (copied and adapted) from Product-Studio-v9.37.01/proxy, not shared at
runtime; both proxies operate against the same Supabase project/tables.

## Local setup

From this directory:

```powershell
npm install
$env:PORT = "3001"
$env:ALLOWED_ORIGIN = "http://127.0.0.1:5174"
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = Read-Host "Enter pgt-dev service role key"
$env:CT_API_REFERENCE_URL = "http://127.0.0.1:3001/docs/" # this proxy's OWN /docs route now serves it (see "API docs" below) — no longer coincidentally dependent on whichever proxy happens to run on 3001
npm run dev
```

`Read-Host` is only a local PowerShell prompt. Do not place the service-role key in the React `.env.local`, commit it, or send it through chat.

The SQL migration must already be applied to pgt-dev before app-list and Settings actions can work:

```text
../sql/20260916_ai_control_tower_settings.sql
```

The browser calls the proxy at `VITE_API_BASE_URL`, using the Supabase access token in `X-Auth-Token` and the selected company in `X-Company-Id`.

## Routes

Settings API (Supabase JWT + company-admin auth, used only by the React app):

- `GET /api/control-tower/settings/apps`
- `POST /api/control-tower/settings/apps`
- `PATCH /api/control-tower/settings/apps/:appId/capture`
- `POST /api/control-tower/settings/apps/:appId/credentials/issue`
- `POST /api/control-tower/settings/apps/:appId/credentials/rotate`
- `POST /api/control-tower/settings/apps/:appId/credentials/revoke`
- `POST /api/control-tower/settings/apps/:appId/disconnect`
- `GET /api/control-tower/settings/api-reference`

Ingestion API (Bearer API-key auth, for other internal HCLTech apps to report
AI usage/outcome/trace telemetry — ported from Product-Studio-v9.37.01/proxy):

- `POST /v1/usage-events`, `GET /v1/usage-events`
- `PATCH /v1/usage-events/:client_call_id/units-generated`
- `POST /v1/outcomes`, `PATCH /v1/outcomes/:id`
- `POST /v1/outcome-types`, `GET /v1/outcome-types`
- `POST /v1/traces`, `PATCH /v1/traces/:id`, `GET /v1/traces/:id`, `GET /v1/traces/:id/spans`
- `POST /v1/tool-spans`
- `POST /v1/trace-payloads`, `GET /v1/trace-payloads/:usage_event_id`
- `GET /v1/company-apps/me`

Both the Ingestion API and Settings API run against the SAME Supabase
project/tables Product-Studio-v9.37.01's own `/v1` routes use — this proxy is
a second code path to the same data, not a schema fork. Product-Studio's own
`/v1` routes are untouched and keep running; see
`docs/ai-control-tower/ai-control-tower-settings-implementation-spec-v1.md`
for the note on eventual deprecation (not done yet, requires explicit approval).

## API docs (`/docs`)

`GET /docs` (redirects to `/docs/`) serves a Redoc page rendering
`GET /docs/openapi.json` — a spec built at process start by `swagger-jsdoc`
from `@openapi` JSDoc blocks above every route handler in `routes/**/*.js`.
There is no static `openapi.yaml` to hand-edit in this repo: **every new
route added to `routes/**/*.js` MUST include an `@openapi` JSDoc block above
its handler** — that block is what makes it show up in `/docs`; adding docs
is not a separate step from adding the route. `openapi/definition.js` holds
only the hand-written intro/changelog prose and security scheme declarations
that can't be inferred from code.
