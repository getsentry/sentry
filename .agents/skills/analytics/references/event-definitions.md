# Defining New Analytics Events

## Step 1: Find or Create the Domain Event File

Event files live in `static/app/utils/analytics/` and follow the naming pattern `{domain}AnalyticsEvents.tsx`.

Discover existing domain files:

```bash
ls static/app/utils/analytics/*AnalyticsEvents.tsx
```

**Prefer adding events to an existing domain file.** Create a new file only when the feature has no natural home in an existing domain.

## Step 2: Add the Event Type

Add the event key and its parameter types to the domain's `*EventParameters` type:

```typescript
export type FeedbackEventParameters = {
  // Existing events...
  'feedback.filter-applied': {
    filter_type: string;
    source: 'list' | 'detail';
  };
};
```

**Parameter typing rules:**

| Rule                                                                      | Example                                             |
| ------------------------------------------------------------------------- | --------------------------------------------------- |
| Use specific string literals over `string` when values are known          | `source: 'list' \| 'detail'`                        |
| Use `Record<string, unknown>` for events with no custom params            | `'feedback.item-rendered': Record<string, unknown>` |
| Never use `any` for parameter types                                       | Use `unknown` or specific types                     |
| Include `organization` only if you need to override automatic org context | Rarely needed                                       |

## Step 3: Add the Event Map Entry

Add the event key → Amplitude display name mapping:

```typescript
export const feedbackEventMap: Record<keyof FeedbackEventParameters, string | null> = {
  // Existing entries...
  'feedback.filter-applied': 'Feedback: Filter Applied',
};
```

**Amplitude name rules:**

| Scenario                                | Value                               |
| --------------------------------------- | ----------------------------------- |
| Event should go to Amplitude            | `'Human Readable: Title Case Name'` |
| Event is Reload-only (internal metrics) | `null`                              |

The Amplitude name follows `'Domain: Action Description'` format in Title Case.

## Step 4: Register in the Master Registry

If you created a **new domain file**, register it in `static/app/utils/analytics.tsx`:

1. Import the type and event map:

```typescript
import type {MyDomainEventParameters} from './analytics/myDomainAnalyticsEvents';
import {myDomainEventMap} from './analytics/myDomainAnalyticsEvents';
```

2. Add the type to the `EventParameters` interface:

```typescript
interface EventParameters
  // ...existing types
  extends MyDomainEventParameters, Record<string, Record<string, any>> {}
```

3. Spread the map into `allEventMap`:

```typescript
const allEventMap: Record<string, string | null> = {
  // ...existing maps
  ...myDomainEventMap,
};
```

**If you added events to an existing domain file, skip this step** — the domain is already registered.

## Complete Example: New Event in Existing Domain

Adding a "filter applied" event to the feedback domain:

```typescript
// In static/app/utils/analytics/feedbackAnalyticsEvents.tsx

export type FeedbackEventParameters = {
  // ... existing events
  'feedback.filter-applied': {
    filter_type: string;
    source: 'list' | 'detail';
  };
};

export const feedbackEventMap: Record<keyof FeedbackEventParameters, string | null> = {
  // ... existing entries
  'feedback.filter-applied': 'Feedback: Filter Applied',
};
```

## Anti-Pattern: Untyped Event

```typescript
// BAD — will cause TypeScript error, event key not registered
trackAnalytics('feedback.my-new-thing', {
  organization,
  some_param: 'value',
});

// GOOD — define the event type and map entry first, then call
trackAnalytics('feedback.filter-applied', {
  organization,
  filter_type: 'status',
  source: 'list',
});
```
