# Dashboard & Widget Error Patterns

## Contents

- Overview
- Real examples
- Detection checklist

## Overview

Dashboard widget errors account for 6 issues and 90,482 events. The core problem is widget visualization components that throw exceptions when receiving unexpected data from APIs, rather than rendering graceful empty states. Two dominant patterns:

1. **No plottable values**: Charts throw when all data is null, empty, or non-numeric (38K events, 3.4K users)
2. **Unsupported widget configurations**: Functions like `getWidgetExploreUrl` throw when called with widget types they do not support (51K events)

## Real Examples

### [JAVASCRIPT-334P]: getWidgetExploreUrl — multiple queries for logs unsupported (unresolved)

**Stacktrace:**

```
./app/views/dashboards/widgetCard/widgetCardContextMenu.tsx
  actions (line 256)
    to: getWidgetExploreUrl(widget, dashboardFilters, selection, organization, Mode.SAMPLES),

./app/views/dashboards/utils/getWidgetExploreUrl.tsx
  getWidgetExploreUrl (line 106)
    if (widget.queries.length > 1) {
      if (traceItemDataset === TraceItemDataset.LOGS) {
        Sentry.captureException(new Error(`getWidgetExploreUrl: multiple queries for logs is unsupported...`));
      }
    }
```

**Root cause:** The widget context menu eagerly computes the "Open in Explore" URL for all widget types. For log widgets with multiple queries, this is unsupported. The function captures an exception every time the menu is rendered.

**Fix pattern:** Check widget configuration before computing the URL. Disable the menu item for unsupported configurations.

```typescript
const canOpenInExplore = widget.widgetType !== WidgetType.LOGS || widget.queries.length <= 1;
if (canOpenInExplore) {
  menuOptions.push({key: 'open-in-explore', to: getWidgetExploreUrl(...)});
}
```

### [JAVASCRIPT-34B7]: The data does not contain any plottable values (unresolved, 10 variants merged)

**Stacktrace:**

```
./app/views/dashboards/widgets/categoricalSeriesWidget/categoricalSeriesWidgetVisualization.tsx
  CategoricalSeriesWidgetVisualization
    throws Error("The data does not contain any plottable values.")
```

**Root cause:** Widget visualization throws when the API returns data with no numeric values to plot. This happens when widgets are configured with queries that return empty results, all-null columns, or non-numeric data.

**Fix pattern:** Replace the throw with an empty-state render.

```typescript
if (!hasPlottableValues(data)) {
  return <EmptyStateWarning>{t('No data available to display.')}</EmptyStateWarning>;
}
```

### [JAVASCRIPT-336V]: Unable to fetch releases (resolved)

**Root cause:** Dashboard widget's release data fetch fails and propagates as an unhandled exception instead of showing an error state.

**Fix pattern:** Catch fetch errors and surface them as widget-level error states.

## Detection Checklist

- [ ] Do chart/visualization components handle empty or null data gracefully?
- [ ] Is widget data validated before being passed to rendering functions?
- [ ] Do utility functions like `getWidgetExploreUrl` check widget type compatibility?
- [ ] Are API fetch errors caught and displayed as widget error states?
- [ ] Do `captureException` calls in render paths have deduplication?
- [ ] Is `parseFunction()` guarded against undefined field values?
