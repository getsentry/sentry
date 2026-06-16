# Amplitude MCP — Discovery and Querying

## Setup (One-Time)

If the Amplitude MCP is not connected:

1. Tell the user to run `/mcp` in Claude Code
2. Select **"claude.ai Amplitude"** from the list
3. Authenticate via Sentry SSO

Once connected, the `mcp__claude_ai_Amplitude__*` tools become available.

## Discover the Amplitude Project

Call `get_context` to find the Sentry organization and its projects. Use the `appId` for the `sentry.io` project as the `projectId` in all subsequent Amplitude tool calls.

## Discovery Workflow

When a user asks "how many people do X?" or "are people using Y?":

### Step 1: Find the Event

Use `search` to find matching events by keyword:

```
mcp__claude_ai_Amplitude__search({
  queries: ["seer", "autofix"],
  entityTypes: ["EVENT"],
  limitPerQuery: 20,
  search_goal: "Find events related to the seer feature on issue details"
})
```

This returns Amplitude event names (the `eventName` from our event maps, e.g., `"Issue Details: Seer Opened"`).

If search returns nothing, fall back to grepping the codebase:

```bash
grep -rn "seer\|autofix" static/app/utils/analytics/ --include="*.tsx"
```

### Step 2: Get Event Properties (Optional)

If the user needs to filter or break down by a property:

```
mcp__claude_ai_Amplitude__get_properties({
  propertyType: "event",
  projectId: "<projectId>",
  eventType: "Issue Details: Seer Opened"
})
```

### Step 3: Query the Data

Use `query_dataset` for ad-hoc queries:

```
mcp__claude_ai_Amplitude__query_dataset({
  projectId: "<projectId>",
  definition: {
    type: "eventsSegmentation",
    app: "<projectId>",
    name: "Seer Opens Last 30 Days",
    params: {
      range: "Last 30 Days",
      events: [{
        event_type: "Issue Details: Seer Opened",
        filters: [],
        group_by: []
      }],
      metric: "uniques",
      countGroup: "User",
      groupBy: [],
      interval: 1,
      segments: [{ conditions: [] }]
    }
  }
})
```

Use `query_chart` if the user provides an existing chart ID or URL.

### Step 4: Report Results

- State the event name used and the date range queried.
- Report unique users (not total event count) unless the user asks for totals.
- Offer to break down by property (platform, org, etc.) if the numbers need context.

## Common Query Patterns

| User question                    | Metric    | Event type pattern                        |
| -------------------------------- | --------- | ----------------------------------------- |
| "How many people view X page?"   | `uniques` | `"Page View: ..."`                        |
| "How many clicks on X button?"   | `totals`  | `"Feature: Button Clicked"`               |
| "What's the funnel from X to Y?" | funnel    | Use `type: "funnels"` with ordered events |
| "Are people coming back to X?"   | retention | Use `type: "retention"`                   |

## Searching for Dashboards and Charts

If the user wants an existing dashboard rather than raw data:

```
mcp__claude_ai_Amplitude__search({
  queries: ["seer dashboard", "autofix metrics"],
  entityTypes: ["DASHBOARD", "CHART"],
  limitPerQuery: 10
})
```

## When the MCP Is Not Connected

Fall back to the codebase:

1. Grep event files for the Amplitude name (`eventName` in the event map).
2. Report the event key and Amplitude name so the user can search Amplitude manually.
3. Suggest they connect the Amplitude MCP for direct querying: run `/mcp` → select "claude.ai Amplitude".
