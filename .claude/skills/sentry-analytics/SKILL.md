---
name: sentry-analytics
description: Add frontend analytics events to Sentry codebase. Use when adding tracking for user actions, feature usage, or product metrics. Covers TypeScript trackAnalytics and button click analytics (analyticsEventKey/analyticsEventName props).
---

# Sentry Analytics

Add analytics events to track user actions and feature usage.

## Quick Reference

| Type           | Location                                 | Pattern                                                  |
| -------------- | ---------------------------------------- | -------------------------------------------------------- |
| Button clicks  | Component props                          | `analyticsEventKey`/`analyticsEventName` **(preferred)** |
| Other tracking | `static/app/utils/analytics/*Events.tsx` | `trackAnalytics()`                                       |

## Button Click Analytics (Preferred)

**Use button props for click tracking whenever possible.** This is the simplest approach and provides automatic tracking.

```tsx
<Button
  analyticsEventKey="feature_name.button_clicked"
  analyticsEventName="Feature Name: Button Clicked" // Optional, enables Amplitude
  analyticsParams={{customField: 'value'}} // Optional extra params
  onClick={handleClick}
>
  Click Me
</Button>
```

- `analyticsEventKey`: Reload event key (required for tracking)
- `analyticsEventName`: Amplitude event name (optional, enables Amplitude)
- `analyticsParams`: Additional parameters (optional)

Buttons auto-track: `text`, `priority`, `href`, `parameterized_path`.

## Manual Tracking with trackAnalytics

Use `trackAnalytics()` only when button props aren't applicable (non-click events, effects, form submissions).

### 1. Define event types

Add to appropriate file in `static/app/utils/analytics/` (e.g., `featureAnalyticsEvents.tsx`):

```typescript
export type FeatureEventParameters = {
  'feature_name.action_performed': {
    source: string;
  };
  'feature_name.modal_opened': Record<string, unknown>; // No params
};

export const featureEventMap: Record<keyof FeatureEventParameters, string | null> = {
  'feature_name.action_performed': 'Feature Name: Action Performed', // Amplitude name
  'feature_name.modal_opened': null, // null = don't send to Amplitude
};
```

### 2. Register in index

Add to `static/app/utils/analytics/index.tsx`:

```typescript
import {featureEventMap, type FeatureEventParameters} from './featureAnalyticsEvents';

export type EventParameters =
  // ... existing types
  FeatureEventParameters;

export const allEventMap = {
  // ... existing maps
  ...featureEventMap,
};
```

### 3. Track the event

```typescript
import {trackAnalytics} from 'sentry/utils/analytics';

trackAnalytics('feature_name.action_performed', {
  organization,
  source: 'modal',
});
```

## Naming Conventions

| Context        | Format           | Example                          |
| -------------- | ---------------- | -------------------------------- |
| Event key      | `feature.action` | `issue_details.comment_created`  |
| Amplitude name | Title Case       | `Issue Details: Comment Created` |

## Testing

Set `DEBUG_ANALYTICS=1` in browser localStorage to log events to console.

## Common Patterns

**Track on mount/effect:**

```typescript
useEffect(() => {
  trackAnalytics('feature.viewed', {organization});
}, [organization]);
```

**Track form submission:**

```typescript
const handleSubmit = () => {
  trackAnalytics('feature.form_submitted', {
    organization,
    field_count: fields.length,
  });
};
```
