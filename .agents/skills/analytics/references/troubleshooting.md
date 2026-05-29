# Troubleshooting

## Common Mistakes

| Symptom                                 | Cause                                                      | Fix                                                                        |
| --------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| TypeScript error: event key not found   | Event key not defined in `*EventParameters` type           | Add the event to the domain's type definition and event map                |
| Event fires in Reload but not Amplitude | `eventName` is `null` in the event map                     | Set `eventName` to a human-readable string if Amplitude tracking is needed |
| Duplicate events on page view           | Both route analytics hook AND manual `trackAnalytics` used | Remove the manual call — route analytics fires automatically               |
| Event params missing organization       | `organization` not passed to `trackAnalytics`              | Always pass `organization` as a parameter                                  |
| Button click not tracked                | Missing `analyticsEventKey` prop                           | Add `analyticsEventKey` to the Button component                            |
| Area context returns empty string       | Component not wrapped in `AnalyticsArea`                   | Wrap parent component with `<AnalyticsArea name="...">`                    |
| Route analytics params stale            | Params set after 2s timeout                                | Call `useRouteAnalyticsParams` earlier in the render cycle                 |

## Debugging Locally

Enable analytics debug logging in your browser console:

```javascript
localStorage.setItem('DEBUG_ANALYTICS', '1');
```

This logs all `trackAnalytics` calls and button tracking events to the console. Remove with:

```javascript
localStorage.removeItem('DEBUG_ANALYTICS');
```

## Anti-Patterns

### Direct SDK calls

```typescript
// NEVER do this
window.analytics.track('my_event', {...});
Amplitude.track('My Event', {...});

// ALWAYS use trackAnalytics
trackAnalytics('my_feature.event', {organization, ...});
```

### Untyped events

```typescript
// NEVER call trackAnalytics with an unregistered key
// TypeScript will catch this, but if you bypass it with `as any`:
trackAnalytics('nonexistent.event' as any, {organization});

// ALWAYS define the event type first, then call trackAnalytics
```

### Tracking in render

```typescript
// NEVER track in the render body — fires on every re-render
function MyComponent() {
  trackAnalytics('my_feature.viewed', {organization}); // BAD
  return <div />;
}

// ALWAYS use useEffect for "viewed" events
function MyComponent() {
  useEffect(() => {
    trackAnalytics('my_feature.viewed', {organization});
  }, [organization]);
  return <div />;
}
```

### Creating duplicate events

```typescript
// NEVER create a new event when one already exists
// Search first: grep -rn "feedback" static/app/utils/analytics/

// If 'feedback.list-item-selected' exists, don't create 'feedback.list_item_clicked'
// Reuse the existing event and add params if needed
```

### Overly broad parameter types

```typescript
// AVOID — loses type safety
'my_feature.action': {
  type: string;       // What values can this be?
  data: any;          // Completely untyped
};

// PREFER — explicit and self-documenting
'my_feature.action': {
  type: 'create' | 'update' | 'delete';
  item_count: number;
};
```
