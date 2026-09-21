# AI Control Tower Design Instructions

This document is the design contract for the redesigned AI Control Tower. It applies to the React + Tailwind implementation, future UI changes, and any prototype-derived code. Requirements marked **MUST** are acceptance gates.

## 1. Design principle

AI Control Tower is an operational observability and governance workspace, not a marketing page. The UI **MUST** prioritize fast scanning, explainable cost movement, traceability from outcome to request/payload, and clear governance actions.

Use the v7 prototype as the target visual direction unless a deviation is documented and approved.

## 2. Navigation model

Use left side navigation:

1. Command Center
2. Outcome Economics
3. Cost Analytics
4. Trace Explorer
5. Governance

Navigation rules:

- Side navigation must support expand/collapse.
- Expanded state shows icons and labels.
- Collapsed state shows icons only, not numbers.
- Active item must be visually clear and keyboard accessible.
- Governance must be hidden or inaccessible for readonly users.
- Do not add abstract top-level nav items such as Observability, Traceability, and Explainability. Use those as language/lenses inside pages.

## 3. Shell layout

The app shell **MUST** include:

- Product Studio icon near `AI Control Tower`.
- Left side navigation.
- Compact top bar with App selector, Period selector, and Export action.
- Compact bottom-left user menu using SaaS pattern: avatar, user name, role, chevron.
- User menu items: `My profile`, `Team settings`, `Sign out`.

Do not include large informational cards in the sidebar footer.

## 4. Page design rules

- Do not use large hero banners in operational pages.
- Start pages with the most decision-relevant information.
- Prefer dense but readable cards, tables, lists, filters, and detail drawers.
- Use overlays intentionally: dropdowns for compact selection, sheets/drawers for supplemental detail, dialogs for focused decisions.
- Close controls must be X icon buttons with accessible labels.
- Use consistent period and app selectors across pages.
- Do not place cards inside cards unless the inner card is a repeated entity card.

## 5. Component reference

Use shadcn/ui and Radix UI primitives as the component reference:

- Button
- Card
- Badge
- DropdownMenu
- Dialog
- Sheet
- Tooltip
- Select or Combobox
- Table
- Tabs only inside a page when needed, not for primary nav

Use Lucide icons for navigation and actions.

## 6. Visual system

- Use Tailwind utilities backed by semantic design tokens.
- Do not scatter arbitrary colors, shadows, radii, or spacing values inside feature components.
- Use neutral canvas, restrained brand emphasis, clear borders, and subtle elevation only for overlays.
- Use tabular numerals for currency, token counts, calls, and percentages when available.
- Use sentence case for headings, labels, buttons, and table headers.
- Do not rely on color alone to show status, risk, success, or failure.

Recommended semantic tokens:

```css
:root {
  --background: /* application canvas */;
  --foreground: /* primary text */;
  --surface: /* cards, panels, menus */;
  --surface-muted: /* subtle grouping */;
  --primary: /* active nav, primary action */;
  --primary-foreground: /* text on primary */;
  --muted: /* quiet background */;
  --muted-foreground: /* supporting text */;
  --border: /* dividers */;
  --input: /* input border */;
  --ring: /* focus ring */;
  --success: /* completed or healthy */;
  --warning: /* attention or budget risk */;
  --destructive: /* error or stop action */;
  --info: /* neutral info */;
  --radius: 0.5rem;
}
```

## 7. App and period selectors

- App selector must be a compact dropdown.
- App selector must support multiple producer apps.
- Period selector must be a compact dropdown.
- Dropdown indicators must use a proper chevron icon, never the text letter `v`.
- Custom date selection should open a dialog or popover and preserve the current context.

## 8. Outcome Economics design

Outcome Economics is the primary USP page.

Rules:

- Treat outcome types as app-defined.
- Do not classify outcomes by `session_sum` or `yield_ratio` in the UI.
- Do not assume Product Studio is the only app.
- Use search and compact dropdown filters, not long chip lists, because outcome catalogs can grow.
- Outcome cards must be clickable.
- Outcome detail should open in a drawer/sheet.
- Completed and abandoned states may be shown only where the underlying outcome status and abandonment-window logic support them.
- Label Release Plan as direct authoring cost when appropriate; do not imply stored upstream economic footprint unless supported by data.

## 9. Cost Analytics design

Cost Analytics should regroup existing Cost Breakdown information:

- top drivers
- model economics
- prompt-version impact
- failure cost
- cache usage
- data-quality/trust signals
- Request Explorer

Request Explorer rules:

- Use a table for request-level comparison.
- Include a prompt/trace action comparable to legacy behavior where data is available.
- Filters should be compact and scalable.
- Do not confuse unpriced cost with zero cost.
- Pagination must be clear when only a page of rows is loaded.

## 10. Trace Explorer design

Trace Explorer should feel like an AI observability workspace.

Required structure:

- Search/filter controls at top.
- Trace list panel.
- Run/span hierarchy panel.
- Selected span details panel.
- Payload access where authorized and available.

Rules:

- Do not use a large banner.
- Use traceability and explainability language in concise copy.
- Explain search scope through placeholder/help text, not a bulky how-to block.
- Preserve screen space for the trace list, hierarchy, and details.
- Quick filters should be compact dropdowns if the set can grow.
- Payload viewing must remain governed.

## 11. Governance design

Governance should focus on controls and decisions:

- budget posture
- thresholds
- action on breach
- enforcement support
- alerts
- acknowledge/dismiss actions
- what-if simulation
- role-based unit economics
- optimization opportunities requiring action

Do not let Governance become a duplicate Cost Analytics page.

## 12. Accessibility

Minimum requirements:

- All interactive controls must be keyboard reachable.
- Focus indicators must be visible.
- Icon-only buttons must have accessible names.
- Dropdowns, dialogs, sheets, and menus must return focus to their trigger when closed.
- Tables must use semantic headers.
- Dynamic states should communicate loading, empty, error, and permission conditions clearly.
- Support 200% zoom without clipping essential content.
- Respect reduced motion preferences for non-essential transitions.

## 13. Responsive behavior

Test at minimum:

- 320 px
- 768 px
- 1024 px
- 1440 px

Operational tables may adapt to horizontal scroll or priority columns on smaller screens. Do not hide required workflows on mobile.

## 14. Content rules

- Use plain, precise product language.
- Use AI observability language where it helps: `trace`, `span`, `payload`, `request`, `latency`, `failure`, `token`, `cost`, `outcome attribution`, `unpriced`, `abandoned`, `governed`.
- Avoid slogans, decorative copy, and instructional filler.
- Use `New` only for features not supported by current backend/RPC behavior.

## 15. Definition of done

A UI change is complete only when:

- [ ] It uses shared primitives or documents why a new component is needed.
- [ ] It follows the v7 prototype or documents a deviation.
- [ ] It handles loading, empty, error, success, disabled, and permission states as applicable.
- [ ] It works with keyboard only.
- [ ] It has visible focus states.
- [ ] It uses dropdowns for scalable filters.
- [ ] It uses X icon buttons for close actions.
- [ ] It avoids large operational banners.
- [ ] It does not introduce unapproved backend assumptions.
- [ ] It remains usable at supported viewport widths.
