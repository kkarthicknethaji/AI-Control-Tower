# AI Control Tower React + Tailwind + shadcn Implementation Spec

**Product:** Product Studio  
**Module:** AI Control Tower  
**Source version confirmed:** `v9.37.01` from `scripts/config.js`  
**Target implementation:** React + TypeScript + Tailwind CSS + shadcn/ui-compatible components  
**Source implementation:** Vanilla HTML/CSS/JavaScript page: `ai-cost-tower.html`, `scripts/cost-tower.js`, `scripts/cost-tower-outcomes.js`, `styles/26-cost-tower.css`

---

## 1. Objective

Rebuild AI Control Tower as a production-ready React module while preserving the confirmed backend contracts and existing feature scope from the current vanilla-JS implementation.

The implementation must preserve the redesign direction validated through prototype v7:

1. Side navigation instead of top tabs.
2. Compact SaaS top bar with app selector, period selector, and export.
3. Outcome Economics as the primary USP: cost mapped to app-defined outcomes.
4. Trace Explorer as a proper observability/traceability workspace.
5. Governance focused on budget controls, alerts, enforcement posture, and actionability.
6. No silent invention of new widgets or backend behavior.
7. Every visible click target should either work or be explicitly tagged as `New` / future scope.

---

## 2. Current codebase anchors

### 2.1 Version and app identity

Current source of truth:

- `scripts/config.js:4` -> `APP_VERSION = 'v9.37.01'`
- `scripts/config.js:10` -> `APP_NAME = 'Product Studio'`

React implementation must read the same version/app constants or maintain a single equivalent source of truth. Do not hardcode version text in multiple places.

### 2.2 Current page entry

Existing Product Studio opens the Control Tower from:

- `scripts/main.js:323-325`

Current behavior:

```js
function hdrOpenCostTower(){
  hdrAvatarClose();
  window.open('ai-cost-tower.html', '_blank');
}
```

Target behavior:

```js
function hdrOpenCostTower(){
  hdrAvatarClose();
  window.open('/ai-control-tower/', '_blank');
}
```

Keep the old `ai-cost-tower.html` during rollout as a fallback or redirect, but the new React route should become `/ai-control-tower/`.

### 2.3 Current vanilla tab structure

Existing top-tab markup is in `ai-cost-tower.html:86-93`:

- Overview
- Cost Breakdown
- Outcome-Based Cost
- AI Governance

Target React navigation replaces this with side navigation:

1. Command Center
2. Outcome Economics
3. Cost Analytics
4. Trace Explorer
5. Governance

This is a UI regrouping, not a backend capability change.

### 2.4 Current script graph

Existing page loads:

- `scripts/config.js`
- `scripts/env.js`
- `scripts/auth.js`
- `scripts/cost-tower.js`
- `scripts/cost-tower-outcomes.js`

React target should not load `cost-tower.js` and `cost-tower-outcomes.js` directly. Their logic should be migrated into typed React services/hooks/components.

`env.js` is not committed in the repo and currently defines Supabase environment globals. The React app should keep compatibility with this pattern unless engineering intentionally moves to Vite environment variables.

---

## 3. Technical stack

### 3.1 Recommended stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui component source pattern
- lucide-react icons
- Supabase JS v2

Use shadcn/ui as a component-source approach, not as a black-box runtime component library. Components are copied into the repo under `components/ui` and can be customized.

### 3.2 Recommended shadcn/ui components

Use shadcn/ui components where they match the product need:

| UI need | shadcn/ui component |
|---|---|
| Buttons | `Button` |
| Cards | `Card` |
| Menus | `DropdownMenu` |
| App selector | `Select` or `Popover` + `Command` if searchable |
| Period selector | `DropdownMenu` or `Select` |
| Outcome detail panel | `Sheet` |
| Payload/detail viewer | `Sheet` or `Dialog` |
| Budget controls | `Dialog` |
| What-if simulation | `Dialog` or `Sheet` |
| Alerts | `Alert` + `Card` |
| Tables | `Table` |
| Badges | `Badge` |
| Progress/budget bar | `Progress` |
| Tooltips | `Tooltip` |
| Scroll panels | `ScrollArea` |
| Loading states | `Skeleton` |
| Sidebar separators | `Separator` |

Do not add heavy table/grid libraries in the first pass unless performance forces it. The existing RPCs already paginate request rows.

---

## 4. Build and deployment strategy

### 4.1 Recommended integration strategy

Do not migrate all of Product Studio to React. Implement AI Control Tower as a separate React-built page alongside the existing vanilla app.

Recommended source/output structure:

```text
Product-Studio-v9.37.01/
  apps/
    ai-control-tower/
      index.html
      src/
        main.tsx
        App.tsx
        app/
        components/
        features/
        hooks/
        lib/
        styles/
  ai-control-tower/                 # generated build output, gitignored if desired
  ai-cost-tower.html                # old page kept temporarily
  scripts/
  styles/
  netlify.toml
  package.json
```

Alternative: put source under `src/ai-control-tower`. The important requirement is that the final deployed route is stable and does not break the current static Product Studio app.

### 4.2 Root package changes

Current root `package.json` only exists mainly for Netlify function dependencies. Add React build dependencies and scripts without removing the existing Supabase/function dependencies.

Recommended package scripts:

```json
{
  "scripts": {
    "dev:control-tower": "vite --config vite.control-tower.config.ts",
    "build:control-tower": "vite build --config vite.control-tower.config.ts",
    "build:netlify": "npm run build:control-tower && cp proxy/providerAdapters.js netlify/functions/providerAdapters.js"
  }
}
```

Update `netlify.toml`:

```toml
[build]
  command = "npm run build:netlify"
  publish = "."
  functions = "netlify/functions"
```

Preserve this existing requirement from `netlify.toml`: `proxy/providerAdapters.js` must still be copied to `netlify/functions/providerAdapters.js` during build.

### 4.3 Vite config

Example `vite.control-tower.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "apps/ai-control-tower",
  base: "/ai-control-tower/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/ai-control-tower/src")
    }
  },
  build: {
    outDir: "../../ai-control-tower",
    emptyOutDir: true
  }
});
```

### 4.4 Environment handling

Current vanilla app depends on `scripts/env.js`, which defines `SUPABASE_URL` and `SUPABASE_ANON_KEY` globally. To avoid changing production environment behavior, the React entry page should load it:

```html
<script src="/scripts/env.js"></script>
```

Then create `src/lib/env.ts`:

```ts
declare global {
  interface Window {
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    PROXY_URL?: string;
  }
}

export function getEnv() {
  const SUPABASE_URL = window.SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment. Ensure /scripts/env.js is loaded.");
  }

  return { SUPABASE_URL, SUPABASE_ANON_KEY, PROXY_URL: window.PROXY_URL };
}
```

---

## 5. React source structure

Recommended structure:

```text
apps/ai-control-tower/src/
  main.tsx
  App.tsx

  app/
    ControlTowerShell.tsx
    ControlTowerProvider.tsx
    navigation.ts
    types.ts

  lib/
    supabase.ts
    proxy.ts
    dateRanges.ts
    format.ts
    guards.ts
    constants.ts

  services/
    controlTowerApi.ts
    outcomeApi.ts
    proxyApi.ts

  hooks/
    useBootContext.ts
    useSelectedApp.ts
    usePeriod.ts
    useCommandCenterData.ts
    useOutcomeEconomicsData.ts
    useCostAnalyticsData.ts
    useTraceExplorerData.ts
    useGovernanceData.ts

  components/
    layout/
      Sidebar.tsx
      TopBar.tsx
      UserMenu.tsx
      AppSelector.tsx
      PeriodSelector.tsx
      ExportButton.tsx
    common/
      MetricCard.tsx
      DataCard.tsx
      StatusBadge.tsx
      EmptyState.tsx
      DrawerHeader.tsx
      Money.tsx
      PercentDelta.tsx
    ui/
      # shadcn generated components

  features/
    command-center/
      CommandCenterPage.tsx
      CostHealthStrip.tsx
      TopDriversPanel.tsx
      AgentCostPanel.tsx
      NeedsAttentionPanel.tsx
    outcome-economics/
      OutcomeEconomicsPage.tsx
      OutcomePortfolio.tsx
      OutcomeCard.tsx
      OutcomeDetailSheet.tsx
      OutcomeFilterDropdown.tsx
    cost-analytics/
      CostAnalyticsPage.tsx
      GroupedCostBreakdown.tsx
      ModelEconomicsPanel.tsx
      FailureCostPanel.tsx
      DataQualityPanel.tsx
      RequestExplorerTable.tsx
    trace-explorer/
      TraceExplorerPage.tsx
      TraceList.tsx
      RunHierarchy.tsx
      SpanDetailsPanel.tsx
      PayloadSheet.tsx
      TraceFilterDropdown.tsx
    governance/
      GovernancePage.tsx
      BudgetPosture.tsx
      BudgetControlsDialog.tsx
      AlertsPanel.tsx
      WhatIfDialog.tsx
      RoleEconomicsPanel.tsx
      OpportunityMatrix.tsx
```

---

## 6. Boot/auth/app context

### 6.1 Existing behavior to preserve

Current boot sequence in `scripts/cost-tower.js:181-206`:

1. Read version into header.
2. Check Supabase session.
3. Read active company from localStorage key `pgt_active_company_id`.
4. Query `mt_users_companies` for role and active membership.
5. Resolve active app via `mt_company_apps_list`.

Current governance role helper in `scripts/cost-tower.js:135`:

```js
function actIsGovernanceViewer() {
  return actUserRole === 'admin' || actUserRole === 'member';
}
```

React equivalent:

```ts
export function canViewGovernance(role: string | null) {
  return role === "admin" || role === "member";
}
```

### 6.2 `useBootContext` hook

Responsibilities:

- Create Supabase client.
- Get current session/user.
- Redirect to `/login.html` if missing.
- Read `pgt_active_company_id` from localStorage.
- Fetch membership from `mt_users_companies`.
- Call `mt_company_apps_list`.
- Select active app from per-company localStorage preference.
- Return role, companyId, app list, selected app, and access booleans.

Relevant legacy anchors:

- `scripts/auth.js:7-15` for env and active-company key behavior.
- `scripts/cost-tower.js:122-145` for company/user/role/app global state.
- `scripts/cost-tower.js:152-177` for active app resolution.
- `scripts/cost-tower.js:181-206` for boot order.

### 6.3 App selector behavior

Existing behavior: app switching exists under avatar menu as `Switch App`, backed by `mt_company_apps_list`; see `scripts/cost-tower.js:371-382`.

Target behavior: move app switcher to the top bar as a compact dropdown.

Status: **Re-grouped existing**. Backend already supports it.

Rules:

- Show current app name only, not company name.
- If only one app exists, show it as a disabled compact control or text chip.
- If multiple apps exist, open dropdown.
- On app selection:
  - Store selected app under key `pgt_active_app_id_<companyId>`.
  - Clear React query/cache state for prior app.
  - Refetch all current-page data.
  - Do not reload page unless engineering decides simpler reload is safer.

---

## 7. Data service contract

Create `services/controlTowerApi.ts` as the one place that wraps Supabase RPC/table calls. Do not scatter RPC calls across components.

### 7.1 Core RPC wrappers

| Service function | Existing source | RPC/table |
|---|---|---|
| `listCompanyApps(companyId)` | `actResolveActiveApp` | `mt_company_apps_list` |
| `fetchCostEvents(params)` | `actFetchRows` | `mt_ai_cost_events_list` |
| `fetchCostSummary(params)` | `actFetchCostSummary` | `mt_ai_cost_summary` |
| `fetchCostGrouped(params)` | `actFetchCostGrouped` | `mt_ai_cost_grouped` |
| `fetchTopCalls(params)` | `actFetchTopCalls` | `mt_ai_cost_top_calls` |
| `fetchOpportunities(params)` | `actFetchOpportunities` | `mt_ai_cost_opportunities` |
| `fetchOpportunitySupportingCalls(params)` | `actFetchOpportunitySupportingCalls` | `mt_ai_cost_opportunity_supporting_calls` |
| `fetchTraceDetail(params)` | `actFetchTraceDetail` | `mt_ai_trace_detail_list` |
| `fetchCostByAgent(params)` | `actFetchCostByAgent` | `mt_ai_cost_by_agent` |
| `fetchBudget(companyId, appId)` | `actLoadBudgetAndAlerts` | `mt_ai_budget_get_active` |
| `fetchAlerts(companyId, appId)` | `actLoadBudgetAndAlerts` | `mt_ai_alerts_list` |
| `fetchPayload(companyId, appId, usageEventId)` | `actOpenPayloadModal` | `mt_ai_trace_payload_get` |
| `upsertBudget(params)` | `actSaveBudget` | `mt_ai_budget_upsert` |
| `acknowledgeAlert(alertId)` | current governance action | `mt_ai_alert_acknowledge` |
| `dismissAlert(alertId)` | current governance action | `mt_ai_alert_dismiss` |

### 7.2 Outcome RPC wrappers

Create `services/outcomeApi.ts`.

| Service function | Existing source | RPC/API |
|---|---|---|
| `fetchOutcomeRows(params)` | `_outcomesFetchOutcomeRows` | `mt_outcomes_list` |
| `fetchOutcomeTypes(appId)` | `_outcomesFetchTypes` | `mt_outcome_types_list` |
| `fetchCallerModes(appId)` | `_outcomesFetchCallerModes` | `/api/outcome-caller-modes?app_id=...` |

### 7.3 Lookup helpers

| Service function | Existing source | Source |
|---|---|---|
| `fetchProductNames(companyId)` | `actLoadProductNames` | `mt_products` direct query |
| `fetchTeamNames(companyId)` | `actLoadTeamNames` | `/api/cost-tower/team-names` |

Existing team-name proxy call is in `scripts/cost-tower.js:1020-1034` and backend route in `proxy/server.js:2213-2217`.

---

## 8. State model

### 8.1 Global shell state

```ts
type NavKey =
  | "command-center"
  | "outcome-economics"
  | "cost-analytics"
  | "trace-explorer"
  | "governance";

interface ControlTowerShellState {
  activeNav: NavKey;
  sidebarCollapsed: boolean;
  selectedAppId: string | null;
  selectedPeriod: PeriodSelection;
  userMenuOpen: boolean;
}
```

### 8.2 Period model

Preserve existing period choices:

- This Month
- Last Month
- Last 3 Months
- Overall
- Custom Range

Existing implementation anchors:

- `actResolvePeriodRange` in `scripts/cost-tower.js:459-472`.
- Outcome independent period state in `scripts/cost-tower-outcomes.js:621-678`.

Target behavior:

- Use one shared `PeriodSelector` in the top bar for all pages unless a page explicitly requires independent period state.
- Period dropdown chevron must use an icon, not text `v`.
- Custom range opens a dialog with X close button.
- Changing period refetches the current page data and any global summary cards used by that page.

---

## 9. Page specifications

## 9.1 Command Center

### Purpose

Executive starting point: observe spend, risk, usage, outcome attribution, budget posture, and the next action.

### Uses existing data

- `mt_ai_cost_summary`
- `mt_ai_cost_grouped('feature')`
- `mt_ai_cost_grouped('model')`
- `mt_ai_cost_grouped('product')`
- `mt_ai_cost_by_agent`
- `mt_ai_budget_get_active`
- `mt_ai_cost_opportunities`

### Components

```text
CommandCenterPage
  CostHealthStrip
  OutcomeSpendSummaryCard
  TopDriversPanel
  AgentCostPanel
  NeedsAttentionPanel
  UnassignedSpendPanel
```

### UX rules

- No large banner.
- Prioritize metrics above explanatory copy.
- Use language aligned to AI tech users:
  - Observability: current spend, calls, tokens, failures, pricing match.
  - Traceability: links into Request/Trace Explorer.
  - Explainability: driver cards explain why cost moved.
- `Share View` must not appear unless explicitly scoped as New. It is not in current legacy implementation.

---

## 9.2 Outcome Economics

### Purpose

Primary USP: answer “What product/business outcomes did this AI spend create?”

### Critical product rule

Do **not** classify the UI by `costing_method`. `session_sum` and `yield_ratio` are calculation strategies, not user-facing outcome categories. Product Studio is one producer app, and future apps may define different outcome types.

### Uses existing data

- `mt_outcome_types_list(appId)`
- `mt_outcomes_list(companyId, appId, period)`
- `mt_ai_cost_grouped('outcome_type')`
- `mt_ai_cost_grouped('feature')`
- `mt_ai_cost_top_calls(..., partition_by='outcome_type')`
- `mt_ai_cost_top_calls(..., partition_by='caller')`
- `/api/outcome-caller-modes?app_id=...`

### Components

```text
OutcomeEconomicsPage
  OutcomeKpiStrip
  OutcomePortfolio
  OutcomeFilterDropdown
  OutcomeCard
  OutcomeDetailSheet
  AbandonedOutcomeCostTable
```

### Outcome filter behavior

Use one compact dropdown filter, not chips.

Recommended options:

- All outcome cards
- Discovery Map
- Market Intelligence Report
- Release Plan
- Adoption Readiness Plan
- Requirement Agent Brief
- Capability
- Experiment
- KPI Dictionary Entry
- Feature
- AI Recommendation
- Prototype
- Story

In future, options come from `mt_outcome_types_list(appId)`, so the filter remains scalable for many apps/outcomes.

Do not show both outcome-card and canvas filters because they are functionally duplicative for current Product Studio outcomes.

### Outcome card click behavior

Every outcome card must open an `OutcomeDetailSheet`.

Sheet content:

- Outcome name
- Canvas/app context
- Total cost
- Cost formula explanation based on underlying costing method, but not grouped by method in the UI
- Completed/in-progress/abandoned details where meaningful
- Sample calls
- Link/button to Trace Explorer filtered to relevant usage/outcome if supported by current data

Close control must be an X icon, not a text “Close” CTA.

### Release Plan caveat

Preserve current confirmed behavior: Release Plan direct authoring cost exists; upstream economic footprint is not stored in the outcome record and should not be represented as an available backend fact.

If a footprint section is kept, tag it as `New` or show an unavailable-state note.

---

## 9.3 Cost Analytics

### Purpose

Explain cost movement and operational drivers.

### Uses existing data

- `mt_ai_cost_grouped('feature')`
- `mt_ai_cost_grouped('product')`
- `mt_ai_cost_grouped('model')`
- `mt_ai_cost_grouped('user')`
- `mt_ai_cost_grouped('prompt_version')`
- `mt_ai_cost_grouped('selection_rule')`
- `mt_ai_cost_grouped('tier')`
- `mt_ai_cost_grouped('failure_phase')`
- `mt_ai_cost_grouped('variance_cause')`
- `mt_ai_cost_summary`
- `mt_ai_cost_top_calls`

### Components

```text
CostAnalyticsPage
  GroupedCostBreakdown
  ModelEconomicsPanel
  PromptVersionImpactPanel
  OperationalSignalsPanel
  DataQualityPanel
  RequestExplorerTable
```

### Data Quality note

Data Quality is not a new capability. It is a regrouping of existing trust/audit signals already present in legacy code:

- Pricing Match Rate
- Unpriced Calls
- Null-Token Calls
- Model Variance

Legacy anchor: `scripts/cost-tower.js:1885-1895`.

Mark it in internal design comments as **Re-grouped existing**.

### Request Explorer behavior

Existing legacy behavior includes a Prompt column with an inspect affordance. Preserve this.

Legacy anchors:

- Prompt cell: `scripts/cost-tower.js:1940-1946`
- Delegated click listener: `scripts/cost-tower.js:1953-1975`
- Payload modal RPC: `scripts/cost-tower.js:2466-2493`

Target behavior:

- Request table includes a `Prompt / Trace` column.
- Clicking `View prompt` opens the Payload Sheet or Trace Explorer with the selected span/request context.
- If the row has `trace_id`, provide a clear path to the trace hierarchy.
- If payload is not captured or expired, show a clear governed empty state.
- For non-governance users, hide the prompt/payload action and show metadata-only rows.

---

## 9.4 Trace Explorer

### Purpose

Observability and traceability workspace: move from request list to trace hierarchy to span detail to payload inspection.

### Uses existing data

- `mt_ai_trace_detail_list`
- `mt_ai_cost_events_list`
- `mt_ai_trace_payload_get`
- `mt_ai_cost_by_agent`

### Components

```text
TraceExplorerPage
  TraceSearchBar
  TraceFilterDropdown
  TraceList
  RunHierarchy
  SpanDetailsPanel
  PayloadSheet
```

### UX rules

- No large banner.
- Use compact helper text only when needed.
- Search placeholder must be self-explanatory, e.g.:
  - “Search trace, agent, feature, model, outcome, or request id”
- Filters should use compact dropdowns, not long chip lists, because future filters can grow.
- Three-panel layout:
  1. Trace list
  2. Run/span hierarchy
  3. Selected span details/payload action
- Use AI observability language:
  - Trace
  - Span
  - Run hierarchy
  - Payload
  - Latency
  - Status
  - Cost
  - Outcome link

### Trace access rule

Trace detail and payload viewing are governance-gated in the current backend. The UI must respect this:

- Governance viewer: show traces, span details, payload actions.
- Non-governance viewer: show metadata-level cost analytics only; do not show trace/payload actions.

Existing gate anchor: `actIsGovernanceViewer()` in `scripts/cost-tower.js:135`.

---

## 9.5 Governance

### Purpose

Control and governance: budget posture, controls, alerts, enforcement behavior, role economics, and optimization actions.

### Uses existing data

- `mt_ai_budget_get_active`
- `mt_ai_budget_upsert`
- `mt_ai_alerts_list`
- `mt_ai_alert_acknowledge`
- `mt_ai_alert_dismiss`
- `mt_ai_cost_summary`
- `mt_ai_cost_grouped('user_role')`
- `mt_ai_cost_opportunities`
- `mt_ai_cost_opportunity_supporting_calls`

### Components

```text
GovernancePage
  BudgetPosture
  BudgetControlsDialog
  AlertsPanel
  WhatIfDialog
  RoleEconomicsPanel
  OptimizationOpportunities
  OpportunityMatrix
  SupportingCallsDialog
```

### UX rules

Governance should not become another analytics dashboard. It should focus on:

- Budget posture
- Budget thresholds
- Action on breach
- Enforcement support
- Alerts
- Acknowledge/dismiss actions
- Optimization decisions
- What-if simulation

Do not put detailed trace payloads, request audit tables, or broad outcome portfolio content here.

### Required interactions

- `Update Controls` opens budget controls dialog.
- Save calls `mt_ai_budget_upsert`.
- `Run What-if` opens a simulation dialog.
- Alert acknowledge/dismiss buttons call their respective RPCs and update UI state.
- Supporting calls opens evidence dialog using `mt_ai_cost_opportunity_supporting_calls`.
- Dialog close buttons must be X icons.

---

## 10. Sidebar and top bar specification

## 10.1 Sidebar

### Required behavior

- Side navigation replaces legacy top tabs.
- Collapse/expand control must work.
- Collapsed state shows icons, not numbers.
- Active nav item remains visually clear.
- Bottom area uses a standard SaaS user menu, not a large card.

### Recommended nav icons

Using lucide-react:

| Nav item | Icon |
|---|---|
| Command Center | `LayoutDashboard` |
| Outcome Economics | `Target` or `ChartNoAxesCombined` |
| Cost Analytics | `BarChart3` |
| Trace Explorer | `GitBranch` or `Workflow` |
| Governance | `ShieldCheck` |

### Bottom user menu

Compact row:

- Avatar initials
- User name
- Role/subtitle
- Chevron

Dropdown items:

- My profile
- Team settings
- API Documentation
- Sign out

Remove `Account settings` unless Product Studio has a real destination for it.

---

## 10.2 Top bar

Top bar items:

1. Current page title.
2. App selector: `App: Product Studio` with dropdown if multiple apps exist.
3. Period selector.
4. Export button.

Rules:

- Do not show company name in the main top bar.
- App selector should be compact and visually balanced with the period/export controls.
- Dropdown chevrons must be icons, not text `v`.
- Export calls the relevant export behavior for the active page.

---

## 11. Export behavior

Existing legacy export uses `html2canvas` + `jsPDF` from `actDownloadReport(screen)` in `scripts/cost-tower.js:2857`.

React implementation options:

1. Keep `html2canvas` + `jsPDF` for parity.
2. Scope export target by page component ref.
3. Add page title and period metadata before export.

Example:

```ts
export async function exportPageToPdf(target: HTMLElement, title: string) {
  // Preserve existing behavior unless engineering chooses a server-side export later.
}
```

Backend support is not required for export parity.

---

## 12. Styling and design system

### 12.1 Tailwind token mapping

Existing styles use CSS custom properties in `styles/00-tokens.css` and Control Tower-specific styles in `styles/26-cost-tower.css`.

React/Tailwind implementation should map the approved visual language into Tailwind theme tokens:

- Backgrounds
- Borders
- Text hierarchy
- Accent color
- Success/warn/error colors
- Radius
- Shadows
- Spacing

Avoid raw one-off colors scattered across components.

### 12.2 Product icon

Use the Product Studio icon provided in the latest prototype iteration near the “AI Control Tower” sidebar brand area.

Implementation:

- Place icon at `apps/ai-control-tower/public/product-studio-icon.ico` or root `/assets/product-studio-icon.ico`.
- Render with `<img>`.
- Do not use the old text “AI” logo.

---

## 13. TypeScript data types

Create a minimal typed model based on confirmed RPC return fields.

Examples:

```ts
export interface CostSummary {
  total_cost: number;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  priced_calls: number;
  unpriced_calls: number;
  failed_calls: number;
  failed_cost: number;
  balanced_frontier_calls: number;
  cache_eligible_input: number;
  cache_read_tokens: number;
  cache_savings: number;
  null_token_calls: number;
  model_variance_calls: number;
}

export interface CostEventRow {
  request_started_at: string;
  product_id: string | null;
  user_id: string | null;
  user_role_at_call: string;
  caller: string;
  prompt_version: string | null;
  provider: string;
  requested_model: string;
  response_model: string | null;
  selection_rule: string;
  input_tokens: number | null;
  output_tokens: number | null;
  status: string;
  error_type: string | null;
  failure_phase: string | null;
  duration_ms: number | null;
  request_bytes: number | null;
  response_bytes: number | null;
  calculated_cost: number | null;
  outcome_id: string | null;
  units_generated: number | null;
  usage_event_id: string | null;
  trace_id: string | null;
  total_row_count: number;
}
```

Do not guess fields not returned by RPCs.

---

## 14. New vs existing feature labeling

### 14.1 Existing / regrouped existing

| UX element | Status |
|---|---|
| Side nav | New UI layout, no backend change |
| App dropdown in top bar | Re-grouped existing app switch behavior backed by `mt_company_apps_list` |
| Period dropdown | Existing behavior, redesigned presentation |
| Outcome card detail sheet | Existing outcome modal behavior, redesigned presentation |
| Request prompt/payload action | Existing Prompt column and payload modal behavior |
| Data Quality panel | Re-grouped existing pricing/unpriced/null-token/model-variance signals |
| Governance controls dialog | Existing budget upsert behavior, redesigned presentation |
| What-if dialog | Existing client-side simulation, redesigned presentation |
| User menu | Existing account/team/API/sign-out routes, redesigned presentation |

### 14.2 Tag as `New` if included

| Capability | Reason |
|---|---|
| Saved views | No confirmed backend persistence |
| Share view | Not in legacy; removed from latest prototype |
| Server-side advanced trace filtering | Current trace detail RPC returns capped trace detail, not full query grammar |
| Persisted Release Plan upstream economic footprint | Current backend does not store it in outcome record |
| Cross-app aggregate view | Current UI selects one app; multi-app comparison would need UX/data decisions |

---

## 15. Implementation phases

### Phase A - Scaffold

1. Add Vite React app structure.
2. Add Tailwind and shadcn setup.
3. Add Product Studio icon asset.
4. Add app shell route `/ai-control-tower/`.
5. Update `hdrOpenCostTower()` to open new route.
6. Keep old `ai-cost-tower.html` as fallback.

Acceptance:

- New page loads.
- User session is detected.
- Missing session redirects to login.
- App selector shows current app.
- Sidebar collapses/expands.

### Phase B - Data services

1. Create Supabase client.
2. Implement all service wrappers.
3. Implement period range helper.
4. Implement product/user name lookup helpers.
5. Add error and loading states.

Acceptance:

- RPC wrappers return typed data.
- Role and app gates work.
- App changes refetch data.

### Phase C - Command Center and Cost Analytics

1. Build Command Center from existing summary/grouped/agent/opportunity data.
2. Build Cost Analytics with grouped breakdowns and Request Explorer.
3. Preserve Prompt/Payload inspect behavior.

Acceptance:

- Metrics match legacy values for same company/app/period.
- Request Explorer pagination works.
- Payload action works for governance users.

### Phase D - Outcome Economics

1. Build app-defined outcome portfolio.
2. Add one compact outcome filter dropdown.
3. Build detail sheet for outcome cards.
4. Preserve Release Plan direct-cost caveat.

Acceptance:

- Outcome totals match legacy calculations.
- All outcome cards are clickable.
- No UI grouping by `costing_method`.
- App switch changes outcome catalog.

### Phase E - Trace Explorer

1. Build trace list.
2. Build run/span hierarchy.
3. Build selected span detail panel.
4. Link request Prompt/Payload actions to trace/payload detail.

Acceptance:

- Trace hierarchy respects `trace_id`, `span_id`, `parent_span_id`, `sequence_order`.
- Payload sheet respects governance gate and expired/missing payload states.

### Phase F - Governance

1. Build budget posture.
2. Build budget controls dialog.
3. Build alerts panel and alert actions.
4. Build what-if dialog.
5. Build opportunities and supporting calls dialog.

Acceptance:

- Save budget calls `mt_ai_budget_upsert`.
- Acknowledge/dismiss updates UI.
- What-if simulation works client-side.
- Governance nav hidden/blocked for readonly users.

### Phase G - Hardening and parity

1. Add accessibility checks.
2. Add loading skeletons.
3. Add empty/error states.
4. Add export parity.
5. Compare values against legacy page for identical periods.
6. Add feature flags for old/new page rollout.

Acceptance:

- No silent dead clicks.
- Core values match legacy.
- Mobile/tablet layout does not break.
- Old page can be restored quickly if rollout fails.

---

## 16. Testing plan

### 16.1 Unit tests

Test pure helpers:

- `resolvePeriodRange`
- `formatMoney`
- `formatPct`
- `canViewGovernance`
- outcome portfolio calculations
- trace hierarchy grouping

### 16.2 Integration tests

Mock Supabase RPC responses and test:

- boot flow
- app switching
- period switching
- request explorer pagination
- outcome detail sheet
- payload sheet states
- budget save
- alert acknowledge/dismiss

### 16.3 Visual/regression checklist

- Sidebar expanded/collapsed.
- App dropdown open/closed.
- Period dropdown open/closed.
- Outcome detail sheet.
- Payload sheet.
- Budget controls dialog.
- What-if dialog.
- Governance hidden for readonly.
- Empty states for no usage/no outcomes/no traces.

---

## 17. Accessibility requirements

- Sidebar nav buttons must have accessible labels in collapsed mode.
- Dropdowns must support keyboard navigation.
- Dialogs/sheets must trap focus and close on Escape.
- X close buttons must have `aria-label="Close"`.
- Tables must use semantic table markup.
- Status should not rely on color only; include text labels.
- Search fields must have clear placeholders and labels.

---

## 18. Performance requirements

- Do not fetch all cost events for dashboard cards; use aggregate RPCs.
- Keep `mt_ai_cost_events_list` paginated with max 1,000 rows per page.
- Cache by `companyId | appId | period | groupBy`.
- Invalidate cache on app/period change.
- Avoid rendering thousands of DOM rows.
- Keep trace detail bounded by current RPC behavior unless backend changes.

---

## 19. Acceptance criteria

The React implementation is acceptable when:

1. It opens from Product Studio through `hdrOpenCostTower()`.
2. It preserves Supabase session/company/app behavior.
3. It shows side navigation with working collapse/expand and icons.
4. It shows compact App and Period dropdowns with proper chevron icons.
5. It does not show company name in the main top bar.
6. Outcome filters use a compact dropdown, not chips.
7. Outcome cards are clickable and open detail sheets.
8. Request Explorer preserves Prompt/Payload inspection.
9. Trace Explorer presents trace -> span -> payload flow.
10. Governance controls and what-if interactions are functional.
11. All dialogs/sheets use X close buttons.
12. Any non-existing capability is tagged as `New` or omitted.
13. Metrics match the legacy implementation for the same app, company, and period.
14. Readonly users cannot access Governance/trace/payload areas that are governance-gated.
15. The old vanilla page remains available or recoverable during rollout.

---

## 20. Non-goals

Do not implement these as part of the first React migration unless explicitly approved:

- Redesign of the entire Product Studio app.
- New database schema.
- New RPCs.
- Saved views.
- Share view.
- Cross-app aggregate analytics.
- Persisted Release Plan upstream footprint.
- Full observability platform parity with Langfuse/LangSmith.

The goal is a polished React implementation of the agreed Control Tower redesign using the existing confirmed data model and RPC contracts.
