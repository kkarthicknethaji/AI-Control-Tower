---
applyTo: "**/*"
---

# AI Control Tower Path-Specific Instructions

Apply these instructions whenever the task touches AI Control Tower, React implementation files, Tailwind/shadcn UI components created for Control Tower, Supabase/RPC wrappers, or the legacy files listed below.

## Existing code anchors

Treat these files as source-of-truth references before changing behavior:

- `ai-cost-tower.html`
- `scripts/cost-tower.js`
- `scripts/cost-tower-outcomes.js`
- `styles/26-cost-tower.css`
- `scripts/config.js`
- `scripts/auth.js`
- `scripts/main.js`

## Confirmed Product Studio version under review

The Phase 1 discovery was performed against Product Studio `v9.37.01`.

## Confirmed current Control Tower tabs

The legacy implementation has four top-level tabs:

1. Overview
2. Cost Breakdown
3. Outcome-Based Cost
4. AI Governance

The redesigned React implementation should use these as raw material, not as direct navigation. The target side navigation is:

1. Command Center
2. Outcome Economics
3. Cost Analytics
4. Trace Explorer
5. Governance

## Confirmed RPC contracts to preserve

Do not rename or replace these without explicit approval:

- `mt_company_apps_list`
- `mt_ai_cost_summary`
- `mt_ai_cost_grouped`
- `mt_ai_cost_by_agent`
- `mt_ai_cost_events_list`
- `mt_ai_cost_top_calls`
- `mt_ai_trace_detail_list`
- `mt_ai_trace_payload_get`
- `mt_outcome_types_list`
- `mt_outcomes_list`
- `mt_ai_budget_get_active`
- `mt_ai_budget_upsert`
- `mt_ai_alerts_list`
- `mt_ai_alert_acknowledge`
- `mt_ai_alert_dismiss`
- `mt_ai_cost_opportunities`
- `mt_ai_cost_opportunity_supporting_calls`
- `mt_ai_record_usage_event_with_span` (Ingestion API `/v1/usage-events` write path, ported into `ai-control-tower-proxy`)
- `mt_ai_record_tool_span` (Ingestion API `/v1/tool-spans` write path, ported into `ai-control-tower-proxy`)

## Confirmed data model concepts

- Usage ledger: `mt_ai_usage_events`
- Trace model: `mt_ai_traces` -> `mt_ai_spans` -> optional `mt_ai_trace_payloads`
- Outcome model: `mt_outcome_types` + `mt_outcomes`, linked through `mt_ai_usage_events.outcome_id`
- Pricing model: usage events are joined to `mt_model_pricing` by provider, resolved model, and effective pricing window
- App model: `mt_company_apps` and `mt_apps`
- Budget model: `mt_ai_budgets`
- Alert model: `mt_ai_alerts`

## UX rules specific to this redesign

- Use side navigation with icons, labels, and a working collapse/expand control.
- Collapsed navigation must show icons, not numbers.
- Sidebar footer should use a compact B2B SaaS user menu: avatar, user name, role, chevron.
- User menu items: `My profile`, `Team settings`, `Sign out`.
- Header should use a compact app dropdown and period dropdown.
- Dropdown indicators must use real chevron icons, not letter `v`.
- Outcome filters must use scalable dropdowns, not a long row of chips.
- Trace filters must be compact and self-explanatory.
- Outcome cards must be clickable and open a detail drawer or sheet.
- Request Explorer must include a prompt/trace action comparable to the legacy prompt-to-trace/payload behavior where data is available.
- Governance controls and what-if simulation must open working dialogs/sheets.
- Close actions must use X icon buttons with accessible labels.
- Do not use large hero banners inside operational pages.

## Outcome-specific rule

Outcome types are app-defined. Product Studio currently has a known outcome catalog, but other apps may have different outcomes. Do not hardcode Product Studio-only categories into the component structure. Do not classify outcome cards by `session_sum` or `yield_ratio`; those are calculation methods, not user-facing grouping rules.

## New capability handling

If a feature is not supported by existing RPCs or code behavior, either remove it from the implementation or visibly tag/comment it as `New`. Do not silently implement mock behavior as production behavior.

## AI Control Tower proxy OpenAPI docs

`ai-control-tower-proxy` self-documents via `swagger-jsdoc`, not a hand-edited
YAML file. Every route handler added to `ai-control-tower-proxy/routes/**/*.js`
(Settings API or Ingestion API `/v1/*`) MUST include an `@openapi` JSDoc block
directly above it — that block is what generates `/docs`; there is no separate
manual doc-update step. See `ai-control-tower-proxy/README.md`'s "API docs"
section and `ai-control-tower-proxy/openapi/definition.js` for the shared
info/servers/security scheme declarations.
