# Agent instructions — AI Control Tower

This file follows the open [AGENTS.md](https://agents.md) convention so any
coding agent (GitHub Copilot, Claude Code, Cursor, etc.) picks up the same
rules. GitHub Copilot in this repo also reads `.github/copilot-instructions.md`
and `.github/instructions/ai-control-tower.instructions.md` — those are kept
in sync with this file; if you're a different agent, treat this file as the
authoritative source.

Read these first, in order, before creating, reviewing, or modifying code:

1. `docs/ai-control-tower/coding-standards.md` — architecture, data contracts, Supabase/RPC usage, security, testing, implementation boundaries.
2. `docs/ai-control-tower/design-instructions.md` — layout, component, accessibility, responsive behavior, prototype fidelity rules.
3. `docs/ai-control-tower/implementation-guardrails.md` — existing-code anchors, allowed changes, "New" capability handling.
4. `docs/ai-control-tower/ai_control_tower_react_tailwind_implementation_spec.md` — detailed React + Tailwind implementation plan.
5. `prototype/ai_control_tower_phase2_prototype_v7.html` — target interaction and visual design.
6. `.github/instructions/ai-control-tower.instructions.md` — path-specific rules (RPC contracts, data model, UX rules) that apply to any file in this repo.

## Project context

Product Studio (a separate sibling workspace, `Product-Studio-v9.37.01/`) is a
browser-based vanilla JavaScript, HTML, and CSS application with its own
legacy AI Control Tower implementation (`ai-cost-tower.html`,
`scripts/cost-tower.js`, `scripts/cost-tower-outcomes.js`,
`styles/26-cost-tower.css`, `scripts/config.js`, `scripts/auth.js`,
`scripts/main.js`, `proxy/`). This repo (`AI Control Tower`) is the
standalone rebuild: `ai-control-tower-react/` (React + Tailwind + shadcn/ui)
and `ai-control-tower-proxy/` (Express backend — Settings API AND a ported
Ingestion API, see `ai-control-tower-proxy/AGENTS.md`).

## Non-negotiable rules

- Do not rewrite Product Studio outside the AI Control Tower scope, and do not modify `Product-Studio-v9.37.01/` files without explicit user approval.
- Do not delete or replace the legacy AI Control Tower files until the React version is verified and the user explicitly approves switching over.
- Preserve existing Supabase RPC names and request/response expectations (see `.github/instructions/ai-control-tower.instructions.md` for the confirmed RPC contract list).
- Do not invent backend behavior, table names, columns, or RPCs.
- If a UI element needs backend support that does not exist, mark it as `New` and do not wire it as if it already exists.
- Use real RPCs for production data. Prototype sample data is visual guidance only.
- Preserve role behavior: Governance is available only for `admin` and `member`; readonly users must not see or access it.
- Treat Product Studio as one producer app among many. Use app-aware data loading and app-defined outcome types; do not classify outcomes by `costing_method` (that's a cost-calculation method, not a user-facing taxonomy).
- Keep API keys, provider secrets, database secrets, and service-role credentials out of browser bundles and committed code.
- Add focused validation and tests for meaningful behavior changes.

## Target navigation (ai-control-tower-react)

Left side navigation, not top tabs: Command Center, Outcome Economics, Cost Analytics, Trace Explorer, Governance.

## Required workflow before coding

Before editing files, inspect the repo and return a short implementation plan
with: files to create/modify, dependencies to add, how legacy files remain as
fallback, how existing auth/Supabase utilities will be reused, which
features (if any) are marked `New`, and validation commands to run. Do not
start coding until that plan is produced.

## AI Control Tower proxy OpenAPI docs

See `ai-control-tower-proxy/AGENTS.md` for the full rule — in short: every
route handler added to `ai-control-tower-proxy/routes/**/*.js` MUST include
an `@openapi` JSDoc block directly above it. That's what generates `/docs`
(via `swagger-jsdoc`, built fresh at process start) — there is no separate
manual doc-update step, and nothing else keeps the docs in sync.
