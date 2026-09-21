# AI Control Tower Implementation Guardrails

Use this file to prevent scope creep and repeated review churn while implementing the React + Tailwind AI Control Tower.

## 1. Source-of-truth hierarchy

When sources conflict, use this order:

1. Existing Product Studio repo behavior for auth, session, company/app context, and RPC wiring.
2. Confirmed Phase 1 discovery findings.
3. `ai_control_tower_react_tailwind_implementation_spec.md`.
4. `ai_control_tower_phase2_prototype_v7.html` for visual/interaction target.
5. These AI Control Tower handoff instructions.
6. General coding preference.

Do not let the prototype override confirmed backend behavior.

## 2. Existing files to preserve initially

Do not delete in the first implementation pass:

- `ai-cost-tower.html`
- `scripts/cost-tower.js`
- `scripts/cost-tower-outcomes.js`
- `styles/26-cost-tower.css`

You may add a new React-mounted page and later propose switching `scripts/main.js` to open it.

## 3. Build strategy

Preferred sequence:

1. Add minimal React/Vite/Tailwind setup if not present.
2. Create the React Control Tower shell side-by-side.
3. Implement static UI using typed sample fixtures only for component development.
4. Replace fixtures page-by-page with real service/RPC calls.
5. Validate role gating, app switching, period switching, drawers, modals, and table actions.
6. Only then propose routing the existing AI Control Tower menu action to the React page.

## 4. Existing-to-new page mapping

| Legacy area | React page |
|---|---|
| Overview | Command Center |
| Outcome-Based Cost | Outcome Economics |
| Cost Breakdown aggregate sections | Cost Analytics |
| Request Explorer + Trace Explorer + Payload Viewer | Cost Analytics + Trace Explorer |
| AI Governance | Governance |

## 5. What counts as existing versus New

Existing or regrouped existing:

- side navigation replacing top tabs
- app selector backed by existing app-list behavior
- period selector
- export action
- KPI cards from existing summary/grouped RPCs
- outcome cards from `mt_outcome_types_list` and `mt_outcomes_list`
- outcome detail drawer using existing outcome/cost/sample-call data
- request explorer using `mt_ai_cost_events_list`
- prompt/trace action where `usage_event_id` and `trace_id` are available
- trace explorer using `mt_ai_trace_detail_list`
- payload viewer using `mt_ai_trace_payload_get`
- budget and alert actions using existing budget/alert RPCs

Mark as `New` or do not implement without approval:

- persistent saved views
- sharing a view by URL if not already supported
- server-side advanced filtering beyond existing RPC parameters
- trace pagination beyond current capped RPC behavior
- stored Release Plan upstream economic footprint
- new budget enforcement modes not already supported by proxy/backend
- new outcome taxonomy fields
- new app registration UI
- new alert creation rules

## 6. Page-specific guardrails

### Command Center

Use for executive summary only. Do not overload with request-level trace detail.

### Outcome Economics

Outcome types are app-defined. Do not group by `costing_method`. Do not assume all apps have Product Studio outcomes.

### Cost Analytics

Keep it analytical: drivers, model economics, prompt impact, failures, cache, trust signals, request explorer.

### Trace Explorer

Keep it investigative: trace list, span hierarchy, selected span detail, payload access. Do not use large banners.

### Governance

Keep it action-oriented: budget, alerts, enforcement posture, what-if, role economics, optimization actions. Do not duplicate all cost analytics here.

## 7. Validation checklist

Before declaring complete, verify:

- sidebar nav works
- collapsed nav shows icons only
- user menu works and includes My profile, Team settings, Sign out
- app dropdown works
- period dropdown works and uses chevron icon
- custom period works or is clearly marked if deferred
- outcome filters are dropdown-based, not long chip lists
- outcome cards open detail drawer
- request explorer prompt/trace action works where data allows
- trace explorer search and filters are understandable
- selected span detail updates
- payload access is gated
- budget controls modal opens and saves through service layer
- what-if modal opens and computes client-side if supported
- alerts acknowledge/dismiss actions call service layer
- readonly user cannot access Governance
- loading, empty, permission, and error states exist
- no unrelated Product Studio screens changed
