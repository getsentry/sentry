# Analytics Instrumentation Specification

## Intent

Guide users and agents through adding analytics events to Sentry's frontend UI using established patterns. Prioritizes reusing existing events, enforcing type safety, and following naming conventions. Designed to be safe for less-technical users (design, PM, sales) who may not know the analytics architecture.

## Scope

In scope:

- Frontend analytics event definition (TypeScript types, event maps)
- Frontend tracking instrumentation (`trackAnalytics`, route hooks, button props, `AnalyticsArea`)
- Event naming conventions and parameter typing
- Searching for and reusing existing events
- Local debugging with `DEBUG_ANALYTICS`

Out of scope:

- Backend analytics event creation (`src/sentry/analytics/`)
- Amplitude dashboard configuration
- Google Analytics configuration
- Performance metrics (`metric.mark`, `metric.measure`)

## Users And Trigger Context

- Common user requests: "add analytics to this button", "track when users view this page", "what events exist for dashboards", "I need to track clicks on the new filter"
- Should not trigger for: backend-only analytics, Sentry SDK instrumentation, performance monitoring, error tracking setup

## Runtime Contract

- Required first actions: search existing events before defining new ones
- Required outputs: code changes to event definition files and instrumentation call sites
- Non-negotiable constraints: all events must be type-safe; all events flow through `trackAnalytics`; reuse existing events when possible
- Expected bundled files loaded at runtime: `references/event-definitions.md`, `references/tracking-patterns.md`, `references/troubleshooting.md`, `references/amplitude-mcp.md`

## Source And Evidence Model

Authoritative sources:

- `static/app/utils/analytics.tsx` — master event registry
- `static/app/utils/analytics/*.tsx` — domain event definitions
- `static/app/utils/analytics/makeAnalyticsFunction.tsx` — factory function
- `static/app/utils/routeAnalytics/` — route-level tracking hooks
- `static/app/components/analyticsArea.tsx` — area context
- `static/app/components/core/button/types.tsx` — button analytics props

Data that must not be stored:

- Customer organization slugs, names, or IDs
- Internal Amplitude project keys
- Reload backend credentials

## Reference Architecture

- `SKILL.md` contains: routing table, naming rules, non-negotiable constraints, key files
- `references/event-definitions.md` contains: step-by-step event creation, registration, examples
- `references/tracking-patterns.md` contains: route-level, button, manual, and area tracking patterns
- `references/troubleshooting.md` contains: common mistakes, debugging, anti-patterns
- `references/amplitude-mcp.md` contains: Amplitude MCP setup, event discovery, ad-hoc querying, fallback workflow

## Validation

- Lightweight validation: TypeScript compilation catches unregistered event keys
- Deeper validation: `DEBUG_ANALYTICS=1` in browser console confirms events fire
- Acceptance gates: event key exists in domain type, event map entry exists, `trackAnalytics` call compiles

## Known Limitations

- Reload backend registration is in a separate repo (`getsentry/reload`) — this skill cannot automate that step
- Button analytics props are not type-checked against the event registry
- Route analytics timing constraint (2s) is not enforced at compile time

## Maintenance Notes

- When to update `SKILL.md`: new tracking patterns added to the codebase, analytics architecture changes
- When to update references: existing patterns deprecated or new tracking patterns introduced
