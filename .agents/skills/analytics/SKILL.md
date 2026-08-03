---
name: analytics
description: Instrument and discover analytics events in Sentry's frontend UI. Use when adding tracking to buttons, pages, modals, or custom interactions, when defining new analytics events, when searching for existing events, when auditing analytics coverage for a feature, or when answering questions about how users interact with a feature. Trigger on "add analytics", "track event", "instrument analytics", "analytics event", "track click", "track page view", "add tracking", "what events exist for", "audit analytics", "how many people", "how many users", "are people using", "is anyone clicking", "usage of", "who is using".
---

# Analytics Instrumentation

Add analytics events to Sentry's frontend UI using established patterns.

## Answering "How Many People Do X?"

When the user asks about usage, adoption, or interaction counts for a feature:

1. Find the event: search Amplitude first (fastest), fall back to grepping the codebase.
2. If the Amplitude MCP is connected, query the data directly and report results.
3. If no matching event exists, tell the user the event is not tracked — then use `AskUserQuestion` to ask whether they want to instrument it. Do not proceed to instrumentation without explicit confirmation.

Read `references/amplitude-mcp.md` for the full discovery and querying workflow.

## Before Any Change: Search First

**NEVER create a new event without checking if one already exists.**

1. Search `static/app/utils/analytics/` for events matching the feature domain.
2. Grep for keywords related to the interaction (e.g., `clicked`, `viewed`, `created`).
3. If a matching event exists, reuse it — add parameters if needed rather than creating a duplicate.

```bash
grep -rn "keyword" static/app/utils/analytics/ --include="*.tsx"
```

## Event Naming Rules

| Rule                                         | Example                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| Use `snake_case` with dots as separators     | `feedback.list-item-selected`                                          |
| First segment = feature domain               | `dashboards2.`, `issue_details.`, `feedback.`                          |
| Middle segments = section/context (optional) | `dashboards2.edit.`                                                    |
| Last segment = action                        | `.clicked`, `.viewed`, `.created`, `.changed`                          |
| Match the existing domain file's prefix      | If events are in `feedbackAnalyticsEvents.tsx`, use `feedback.` prefix |

**Standard action suffixes:**

| User action           | Suffix                     |
| --------------------- | -------------------------- |
| Clicks a button/link  | `.clicked` or `_clicked`   |
| Views a page          | `.viewed`                  |
| Submits a form        | `.submitted` or `.created` |
| Changes a setting     | `.changed`                 |
| Renders/loads content | `.rendered` or `.loaded`   |
| Dismisses UI          | `.dismissed`               |
| Opens a modal/panel   | `.opened`                  |

## Choose the Right Tracking Pattern

| What to track                             | Pattern                         | Open reference                                   |
| ----------------------------------------- | ------------------------------- | ------------------------------------------------ |
| Page view on route navigation             | Route analytics hooks           | `references/tracking-patterns.md` § Route-Level  |
| Button or link click                      | Button `analyticsEventKey` prop | `references/tracking-patterns.md` § Button       |
| Custom interaction (toggle, drag, select) | `trackAnalytics()` call         | `references/tracking-patterns.md` § Manual       |
| Modal or panel open/close                 | `trackAnalytics()` in handler   | `references/tracking-patterns.md` § Manual       |
| UI area context for events                | `AnalyticsArea` wrapper         | `references/tracking-patterns.md` § Area Context |

## When You Need to Define a New Event

Read `references/event-definitions.md` for step-by-step instructions.

## Common Mistakes and Debugging

Read `references/troubleshooting.md` when:

- An event isn't firing or appearing in Amplitude
- You see TypeScript errors when calling `trackAnalytics`
- You need to debug analytics locally
- You're unsure whether an event needs an Amplitude name

## Key Files

| File                                                              | Purpose                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `static/app/utils/analytics.tsx`                                  | Master registry — all event maps merged, `trackAnalytics` export                      |
| `static/app/utils/analytics/{domain}AnalyticsEvents.tsx`          | Domain-specific event type definitions and name maps                                  |
| `static/app/utils/analytics/makeAnalyticsFunction.tsx`            | Factory that creates typed `trackAnalytics` — do not call directly                    |
| `static/app/utils/routeAnalytics/useRouteAnalyticsEventNames.tsx` | Hook for route-level page view event names                                            |
| `static/app/utils/routeAnalytics/useRouteAnalyticsParams.tsx`     | Hook for route-level page view parameters                                             |
| `static/app/components/analyticsArea.tsx`                         | `AnalyticsArea` component and `useAnalyticsArea` hook                                 |
| `static/app/components/core/button/types.tsx`                     | Button analytics props (`analyticsEventKey`, `analyticsEventName`, `analyticsParams`) |

## Interaction Rules

Users of this skill may be less technical. Use `AskUserQuestion` at every decision point instead of dumping plans or code.

| Situation                                                             | Action                                                                                                                             |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Event not found, user asked a data question                           | Use `AskUserQuestion`: "This isn't tracked yet. Want me to add instrumentation?"                                                   |
| User confirms they want instrumentation                               | Go straight to implementation. Do not show code previews or step-by-step plans — just make the changes and summarize what you did. |
| Implementation is done, needs user action (e.g., Reload registration) | State the remaining step clearly in your summary.                                                                                  |

**Never** dump code blocks as a "plan" and then ask "Want me to make these changes?" — either present a short plain-English summary via `AskUserQuestion` for confirmation, or proceed directly if the user already asked for instrumentation.

## Event Pipeline

Every `trackAnalytics` call flows through the GetSentry override in `static/gsApp/utils/rawTrackAnalyticsEvent.tsx`:

| Destination   | When it fires                               | What it uses | How to query        |
| ------------- | ------------------------------------------- | ------------ | ------------------- |
| **Reload**    | Always                                      | `eventKey`   | Redash              |
| **Amplitude** | When `eventName` is non-null and org exists | `eventName`  | Amplitude UI or MCP |
| **Pendo**     | Same as Amplitude                           | `eventName`  | Pendo               |

- Set `eventName` to a string (e.g., `'Logs Trace Link Clicked'`) to send to both Reload and Amplitude. This is the default for almost all events.
- Set `eventName` to `null` only for high-volume events that would be too expensive for Amplitude. These are Reload-only and queryable via Redash.
- Reload accepts events with `allow_no_schema: true` — no separate registration step is needed.
- When searching for events, note that Reload-only events (`null` name) will not appear in Amplitude search. Fall back to grepping the codebase if Amplitude returns no results.

## Non-Negotiable Constraints

1. **`trackAnalytics()` calls must be type-safe.** Every event key passed to `trackAnalytics()` must exist in a `*EventParameters` type and be registered in the domain's event map. This enforces that `organization` is always passed and that call sites sharing the same event key use consistent parameters. Declarative helpers — button `analyticsEventKey`/`analyticsParams` props and `useRouteAnalyticsParams` — are exempt because each instance is a one-off: two buttons labeled "Save" are inherently different (different forms, different contexts), so there are no shared call sites and less value in centralized types.
2. **Prefer declarative helpers.** Use button analytics props and route analytics hooks when they fit. Fall back to `trackAnalytics()` only for interactions those helpers don't cover.
3. **All events flow through `trackAnalytics()` or built-in helpers.** Never call `window.analytics`, `Amplitude.track()`, or any other analytics SDK directly.
4. **Organization context is automatic.** Pass `organization` to `trackAnalytics` — the override system handles the rest.
5. **Reuse over create.** Always search for existing events before defining new ones.
6. **One event per interaction.** Do not fire multiple events for the same user action.
7. **No PII in event parameters.** Never include user emails, IP addresses, full names, or other personally identifiable information. Use opaque IDs (org ID, user ID) when identity context is needed.
