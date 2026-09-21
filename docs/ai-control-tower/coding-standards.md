# AI Control Tower Coding Standards

This document is the engineering contract for the AI Control Tower React + Tailwind implementation inside Product Studio. Requirements marked **MUST** are acceptance gates. A **SHOULD** requirement may be skipped only when the reason is documented in the implementation notes or PR.

## 1. Product scope

AI Control Tower helps internal and tenant users understand, inspect, and govern AI usage across Product Studio and other producer apps that write usage, trace, payload, outcome, budget, and alert data into the shared Control Tower data model.

The redesigned experience **MUST** support four jobs:

1. Understand overall AI spend and risk.
2. Connect AI cost to product/business outcomes.
3. Inspect requests, traces, spans, prompts, responses, and payload availability where authorized.
4. Govern budget, alerts, enforcement posture, and optimization actions.

The USP is outcome-based AI cost. Do not reduce the module to a generic cost dashboard.

## 2. Implementation baseline

Target stack for this module:

- React with TypeScript.
- Vite or the smallest repo-compatible React build setup.
- Tailwind CSS with semantic tokens.
- shadcn/ui and Radix UI primitives for accessible UI components.
- Lucide icons for navigation and actions.
- Existing Supabase client/auth helpers from Product Studio.
- Existing Node/Express or Netlify proxy paths where already used by the product.

Do not migrate the whole app to React unless explicitly approved.

## 3. Architecture

Implement AI Control Tower as an isolated feature module. Recommended structure:

```text
src/ai-control-tower/
  App.tsx
  main.tsx
  components/
    AppShell.tsx
    Sidebar.tsx
    TopBar.tsx
    AppSelector.tsx
    PeriodSelector.tsx
    UserMenu.tsx
    MetricCard.tsx
    StatusBadge.tsx
    DataTable.tsx
  pages/
    CommandCenter.tsx
    OutcomeEconomics.tsx
    CostAnalytics.tsx
    TraceExplorer.tsx
    Governance.tsx
  services/
    costTowerApi.ts
    mappers.ts
  hooks/
    useActiveCompany.ts
    useApps.ts
    usePeriod.ts
    useCommandCenter.ts
    useOutcomeEconomics.ts
    useCostAnalytics.ts
    useTraceExplorer.ts
    useGovernance.ts
  types/
    costTower.ts
```

Adapt the exact paths to the repo structure, but preserve separation between UI components, hooks, service/RPC wrappers, mappers, and types.

## 4. Dependency rules

- Presentational components **MUST NOT** call Supabase directly.
- RPC calls **MUST** live in service functions or hooks with typed return mappers.
- Shared UI primitives **MUST NOT** contain AI Control Tower business logic.
- App-specific logic **MUST NOT** be hardcoded into generic components.
- Do not use array indexes as keys for trace spans, outcomes, requests, alerts, or apps when stable IDs exist.
- Do not add broad barrel files that obscure dependencies.
- Do not add new runtime dependencies unless they solve a concrete need not already covered by React, Tailwind, shadcn/ui, Radix, Lucide, or existing repo utilities.

## 5. Domain contract

Preserve these meanings across UI, hooks, services, mappers, tests, and copy.

### Cost and usage

- `total_cost`: calculated cost for the selected company, app, and period.
- `calculated_cost`: per-request calculated cost from model pricing where pricing exists.
- `unpriced_calls`: calls that could not be matched to a model pricing row.
- `priced_calls`: calls with matched pricing.
- `failed_cost`: cost associated with calls whose status is `error` or `timeout`.
- `cache_savings`: savings estimate based on cache read tokens and pricing deltas.
- `null_token_calls`: calls with missing token counts.
- `model_variance_calls`: calls where requested and response models differ.

Do not display unpriced calls as zero-cost calls unless the UI explicitly says cost is unknown/unpriced.

### Traceability

- A trace represents a self-contained unit of AI work.
- A span represents a child step within a trace, such as an LLM call or tool call.
- A payload is optional governed prompt/response detail attached to a usage event.
- `trace_id`, `span_id`, `parent_span_id`, and `usage_event_id` must be treated as distinct concepts.
- Non-governance users may not receive or access trace/payload IDs.

### Outcomes

- Outcome types are app-defined rows from `mt_outcome_types`.
- Outcomes are instances from `mt_outcomes`.
- Outcome attribution is linked from `mt_ai_usage_events.outcome_id`.
- `costing_method` describes cost calculation. It is not a UI category.
- `completed` and `abandoned` are meaningful only where the outcome status and abandonment-window logic support them.
- Release Plan direct authoring cost and any upstream footprint must not be blended without clear labeling.

### Governance

- Governance access is role-gated to `admin` and `member`.
- Readonly users must not see Governance navigation or access Governance routes/views.
- Hiding controls is not authorization; preserve backend/RPC checks.
- Enforcement support comes from app metadata such as `supports_enforcement`.

## 6. Existing RPCs

Use the confirmed RPCs as the production data contract:

```text
mt_company_apps_list
mt_ai_cost_summary
mt_ai_cost_grouped
mt_ai_cost_by_agent
mt_ai_cost_events_list
mt_ai_cost_top_calls
mt_ai_trace_detail_list
mt_ai_trace_payload_get
mt_outcome_types_list
mt_outcomes_list
mt_ai_budget_get_active
mt_ai_budget_upsert
mt_ai_alerts_list
mt_ai_alert_acknowledge
mt_ai_alert_dismiss
mt_ai_cost_opportunities
mt_ai_cost_opportunity_supporting_calls
```

If data needed by the prototype is not available from these RPCs or existing direct queries, mark that part `New` and stop for product approval before adding schema/RPC changes.

## 7. TypeScript standards

- Use `strict` TypeScript where the module controls tsconfig.
- Do not use `any`; use `unknown` and narrow at RPC and browser boundaries.
- Public hooks, exported service functions, and mapper functions must have explicit return types.
- Use discriminated unions for load states and permission states.
- Avoid TypeScript `enum`; use literal unions or readonly objects.
- Avoid non-null assertions. Handle missing app, company, budget, outcome, trace, and payload states.

Recommended load state:

```ts
type Loadable<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'empty' }
  | { status: 'error'; message: string; retryable: boolean };
```

## 8. Data loading and state

- Centralize selected app, active company, selected period, role, and active nav state.
- Changing app or period must invalidate/reload the relevant page data.
- App selector should use `mt_company_apps_list` or the existing app-loading behavior.
- Product Studio is a default app, not a hardcoded universal assumption.
- Avoid duplicated date-period logic across pages.
- Use shared period utilities for This Month, Last Month, Last 3 Months, Overall, and Custom.

## 9. Security and privacy

- Never expose provider keys, Supabase service role keys, or database secrets to the browser.
- Use existing auth/session/token refresh behavior.
- Do not log raw prompts, responses, provider payloads, authorization headers, or credentials.
- Payload access must remain governance-gated.
- Render prompt/response payloads safely; escape text and avoid raw HTML injection.
- Treat all RPC responses and URL/search inputs as untrusted boundaries.

## 10. Error and non-ideal states

Every page must handle:

- loading
- empty data
- RPC error
- missing active company
- no app access
- readonly governance restriction
- unpriced calls
- no traces
- no payload captured
- expired payload indicator when returned
- no outcome types for selected app
- no outcomes in selected period
- no active budget
- no alerts

Do not ship only the ideal state.

## 11. Testing standards

Add focused tests where the repo setup supports them. At minimum, cover:

- period utility calculations
- mappers for cost summary/grouped/events/traces/outcomes
- role gating for Governance
- outcome portfolio construction with app-defined outcome types
- unpriced versus zero-cost display handling
- trace hierarchy construction from spans
- app change and period change data reload behavior
- UI smoke tests for nav, dropdowns, drawers, modals, and X close buttons

If no test harness exists, document the manual validation checklist and add lightweight tests only after confirming the repo's package setup.

## 12. Definition of done

A change is complete only when all applicable items are true:

- [ ] React implementation is side-by-side and legacy files remain intact.
- [ ] UI follows the v7 prototype unless a deviation is documented.
- [ ] Existing RPC contracts are preserved.
- [ ] Governance role behavior is preserved.
- [ ] App-aware loading works.
- [ ] Outcome types are treated as app-defined.
- [ ] No invented backend behavior is silently wired.
- [ ] Loading, empty, permission, and error states are implemented.
- [ ] Accessibility basics are met: keyboard use, focus states, accessible names.
- [ ] Type/lint/build checks run where available.
- [ ] Manual or automated validation evidence is documented.
- [ ] No unrelated app-wide refactor is included.
