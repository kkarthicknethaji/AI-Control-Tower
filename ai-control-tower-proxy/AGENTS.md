# Agent instructions — ai-control-tower-proxy

Also see the repo-root `AGENTS.md` for project-wide rules. This file covers
rules specific to this subproject.

## OpenAPI docs are auto-generated — never hand-edit a spec file

This proxy has NO static `openapi.yaml`/spec file to maintain. `/docs` is
built by `swagger-jsdoc` at process start from `@openapi` JSDoc blocks
written directly above each route handler in `routes/**/*.js` (both the
Settings API and the Ingestion API `/v1/*` routes). `openapi/definition.js`
holds only the static, hand-written intro/changelog prose and security
scheme declarations — it has no path/schema entries.

**Rule: every route handler you add or change in `routes/**/*.js` MUST get
an `@openapi` JSDoc block directly above it**, describing at least the path,
method, tags, required request fields, and the response status codes the
handler actually returns. This is not optional and not a follow-up task —
do it in the same edit as the route change. Nothing else keeps `/docs`
accurate; a route without this block simply won't appear there, silently.

Two gotchas confirmed while building this (see any existing route file for
a working example to copy):

1. The `apis` glob passed to `swagger-jsdoc` in `server.js` requires forward
   slashes even on Windows — don't reintroduce a `path.join()`-built pattern,
   it silently matches zero files.
2. A YAML flow-map `description: { ... }` value inside an `@openapi` block
   cannot contain unescaped `{`/`}` (e.g. don't inline a JSON shape in prose
   like `{ description: returns { foo } }`) — wrap the whole description in
   single quotes if it needs to mention braces.

The spec is rebuilt only at process start, not hot-reloaded on save — restart
the proxy (`npm run dev`) to see `/docs` reflect a route/annotation change.

## Two separate auth models in this one proxy

- `/api/control-tower/settings/*` — Supabase JWT (`X-Auth-Token` header) +
  company-admin check. Used only by the React app.
- `/v1/*` (Ingestion API) — Bearer API-key credential, hashed and matched
  against `mt_company_apps.credential_hash`. Used by other internal apps
  reporting AI usage telemetry. Ported from
  `Product-Studio-v9.37.01/proxy/routes/v1/*` (a separate app/repo) — do not
  assume its own `/docs`/`openapi.yaml` still applies here; this proxy is now
  the source of truth for its own copy.

Do not mix these two auth middlewares across route families.
