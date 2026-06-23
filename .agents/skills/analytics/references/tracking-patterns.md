# Tracking Patterns

## Route-Level Page Views

Use route analytics hooks for tracking when a user visits a page. These fire automatically on route navigation.

**Where:** Inside the top-level component for a route (the component rendered by React Router).

```typescript
import {useRouteAnalyticsEventNames} from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';

function MyFeaturePage() {
  const organization = useOrganization();

  // Register the page view event
  useRouteAnalyticsEventNames('my_feature.viewed', 'My Feature: Viewed');

  // Attach contextual parameters
  useRouteAnalyticsParams({
    has_data: true,
    tab: 'overview',
  });

  return <div>...</div>;
}
```

**Rules:**

- Call `useRouteAnalyticsEventNames` exactly once per route component.
- Call `useRouteAnalyticsParams` to add context. It can be called multiple times — params merge.
- `useRouteAnalyticsParams` must be called within 2 seconds of organization context loading.
- Subcomponents can call `useRouteAnalyticsParams` to add their own params (e.g., trace status, replay availability).
- The event fires automatically — do not also call `trackAnalytics` for the same page view.

**Real-world example** (from `static/app/views/issueDetails/groupDetails.tsx`):

```typescript
useRouteAnalyticsEventNames('issue_details.viewed', 'Issue Details: Viewed');
useRouteAnalyticsParams({
  ...getAnalyticsDataForGroup(group),
  ...getAnalyticsDataForEvent(event),
  ...getAnalyicsDataForProject(project),
  tab,
  group_event_type: groupEventType,
});
```

## Button Click Tracking

Use built-in button analytics props for simple click tracking. No event definition required for Reload-only tracking.

```tsx
<Button
  analyticsEventKey="feedback.filter-applied"
  analyticsEventName="Feedback: Filter Applied"
  analyticsParams={{filter_type: 'status', source: 'sidebar'}}
>
  Apply Filter
</Button>
```

**Props:**

| Prop                 | Required | Purpose                                         |
| -------------------- | -------- | ----------------------------------------------- |
| `analyticsEventKey`  | Yes      | Reload event key (snake_case with dots)         |
| `analyticsEventName` | No       | Amplitude display name. Omit to skip Amplitude. |
| `analyticsParams`    | No       | Additional key-value pairs sent with the event  |

**Rules:**

- Prefer button props over a manual `trackAnalytics` call in an `onClick` handler.
- If you need the event to be type-safe and appear in the typed event registry, also define it in the domain event file. Button props work without registration but lose type safety.
- The tracking fires via `TrackingContext` — the GetSentry override wires it to Reload/Amplitude.

## Manual `trackAnalytics()` Calls

Use for interactions that aren't button clicks or page views: toggles, drag actions, form submissions, modal opens, etc.

```typescript
import {trackAnalytics} from 'sentry/utils/analytics';

function handleFilterChange(filterType: string) {
  trackAnalytics('feedback.filter-applied', {
    organization,
    filter_type: filterType,
    source: 'list',
  });
  // ... actual handler logic
}
```

**Rules:**

- Always pass `organization` (string slug or Organization object).
- The event key must be defined in a `*EventParameters` type and registered in the domain event map.
- Call `trackAnalytics` at the point of user action, not in render or effects (unless tracking a "viewed" event).
- For "viewed" events in components that aren't route-level, use a `useEffect`:

```typescript
useEffect(() => {
  trackAnalytics('feedback.banner-viewed', {
    organization,
  });
}, [organization]);
```

## Area Context

Use `AnalyticsArea` to tag events with their UI location. This is useful when the same component appears in multiple contexts.

```tsx
import {AnalyticsArea, useAnalyticsArea} from 'sentry/components/analyticsArea';

// Wrap a section of UI
<AnalyticsArea name="feedback">
  <AnalyticsArea name="details">
    <MyComponent /> {/* useAnalyticsArea() returns "feedback.details" */}
  </AnalyticsArea>
</AnalyticsArea>;

// Use in a component
function MyComponent() {
  const area = useAnalyticsArea();

  function handleClick() {
    trackAnalytics('feedback.action-clicked', {
      organization,
      area, // "feedback.details"
    });
  }
}
```

**Rules:**

- Areas nest with dot notation: `outer.inner`.
- Use `overrideParent` to strip the outer area (e.g., for modals that should have their own top-level area).
- Do not branch app logic on the area value — it is for analytics metadata only.

## Choosing Between Patterns

| Situation                              | Use                                             |
| -------------------------------------- | ----------------------------------------------- |
| User navigates to a page               | Route analytics hooks                           |
| User clicks a `<Button>`               | Button analytics props                          |
| User clicks a non-Button element       | `trackAnalytics()` in click handler             |
| User submits a form                    | `trackAnalytics()` in submit handler            |
| Component renders / becomes visible    | `trackAnalytics()` in `useEffect`               |
| Same component used in multiple places | `AnalyticsArea` + `useAnalyticsArea()`          |
| Feature flag should be tracked         | Add flag value as a param to the existing event |
