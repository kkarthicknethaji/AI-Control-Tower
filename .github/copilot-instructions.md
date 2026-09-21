# Product Studio Copilot Instructions

Before creating, reviewing, or modifying code in this repository, read and follow:

1. `docs/ai-control-tower/coding-standards.md` for architecture, data contracts, Supabase/RPC usage, security, testing, and implementation boundaries.
2. `docs/ai-control-tower/design-instructions.md` for layout, component, accessibility, responsive behavior, and prototype fidelity rules.
3. `docs/ai-control-tower/implementation-guardrails.md` for existing-code anchors, allowed changes, and "New" capability handling.
4. `ai_control_tower_react_tailwind_implementation_spec.md` for the detailed React + Tailwind implementation plan.
5. `ai_control_tower_phase2_prototype_v7.html` for the target interaction and visual design.

## Project context

Product Studio is currently a browser-based vanilla JavaScript, HTML, and CSS application. The existing AI Control Tower implementation is in:

- `ai-cost-tower.html`
- `scripts/cost-tower.js`
- `scripts/cost-tower-outcomes.js`
- `styles/26-cost-tower.css`
- `scripts/config.js`
- `scripts/auth.js`
- `scripts/main.js`

The new work is to implement the redesigned AI Control Tower as a React + Tailwind + shadcn/ui page/module without migrating the whole Product Studio app.

## Non-negotiable rules

- Do not rewrite Product Studio outside the AI Control Tower scope.
- Do not delete or replace the legacy AI Control Tower files until the React version is verified and the user explicitly approves switching over.
- Build the React implementation side-by-side first.
- Preserve existing Supabase RPC names and request/response expectations.
- Do not invent backend behavior, table names, columns, or RPCs.
- If a UI element needs backend support that does not exist, mark it as `New` and do not wire it as if it already exists.
- Use real RPCs for production data once the shell is ready. Prototype sample data is visual guidance only.
- Preserve role behavior: Governance is available only for `admin` and `member`; readonly users must not see or access it.
- Treat Product Studio as one producer app among many. Use app-aware data loading and app-defined outcome types.
- Do not classify outcomes in the UI by `costing_method`; that field describes cost calculation, not a user-facing taxonomy.
- Keep API keys, provider secrets, database secrets, and service-role credentials out of browser bundles and committed code.
- Add focused validation and tests for meaningful behavior changes.

## Target navigation

Use left side navigation, not top tabs:

1. Command Center
2. Outcome Economics
3. Cost Analytics
4. Trace Explorer
5. Governance

## Implementation expectations

- Prefer React + TypeScript + Vite for this module unless repo constraints require a different minimal setup.
- Use Tailwind CSS with semantic design tokens.
- Use shadcn/ui, Radix UI primitives, and Lucide icons where appropriate.
- Use the supplied Product Studio icon near "AI Control Tower".
- Use compact SaaS patterns: side navigation, top app selector, period selector, export action, drawers/sheets for detail, and dropdowns for scalable filters.
- Do not use large banners in operational workspaces.
- Use X icon buttons for close controls, with accessible labels.
- Keep UI copy aligned with AI observability, traceability, and explainability language.

## Required workflow before coding

Before editing files, inspect the repo and return a short implementation plan with:

- files to create
- files to modify
- dependencies to add
- React mount approach
- how legacy files remain as fallback
- how existing auth/Supabase utilities will be reused
- which features, if any, are marked `New`
- validation commands to run

Do not start coding until that plan is produced.

## Database diagnostics with PostgreSQL tools

**Important:** Deferred tools (like `pgsql_connect`, `pgsql_query`, etc.) are NOT automatically available in new chat sessions. Each session starts fresh without them loaded.

**To access Supabase PostgreSQL diagnostics in a new session:**

1. Start your message with: `tool_search("PostgreSQL database connection query")`
2. This loads all available `pgsql_*` tools (connect, query, list_connection_profiles, db_context, etc.)
3. Once loaded, use them to diagnose RPC definitions, schema, and data via the **Supabase-Personal** connection profile

**Available connection profiles:**
- `Supabase-Personal` (profileId: `F5B1B0A9-FAFF-44D2-B09D-ACBD42A74E81`) — connects to real Supabase project; use this for actual diagnostics
- `PS-Dev` (unrelated Azure database; avoid unless explicitly needed)

**Confirmed RPC contracts to preserve** — do not rename or change behavior without explicit approval:
- `mt_company_apps_list`, `mt_ai_cost_summary`, `mt_ai_cost_grouped`, `mt_ai_cost_by_agent`, `mt_ai_cost_events_list`, `mt_ai_cost_top_calls`
- `mt_ai_trace_detail_list`, `mt_ai_trace_payload_get`
- `mt_outcome_types_list`, `mt_outcomes_list`
- `mt_ai_budget_get_active`, `mt_ai_budget_upsert`
- `mt_ai_alerts_list`, `mt_ai_alert_acknowledge`, `mt_ai_alert_dismiss`
- `mt_ai_cost_opportunities`, `mt_ai_cost_opportunity_supporting_calls`
- `mt_ai_record_usage_event_with_span`, `mt_ai_record_tool_span`

See `sql/README.md` and `.github/instructions/ai-control-tower.instructions.md` for data model details.
