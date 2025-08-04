import {type Widget, WidgetType} from 'sentry/views/dashboards/types';

// Checks for specific widget conditions that should force a widget to query the spans dataset instead
// TODO: Deprecate this function when all metric widgets have been migrated to the spans dataset
export function shouldForceQueryToSpans(widget: Widget) {
  // If a widget is using measurements.inp in any field, including as an aggregation and is not using equations or percentile
  if (
    widget.widgetType === WidgetType.TRANSACTIONS &&
    widget.queries.some(query =>
      query.fields?.some(field => field.includes('measurements.inp'))
    ) &&
    !widgetUsesEquations(widget) &&
    !widgetUsesPercentile(widget)
  ) {
    return true;
  }

  return false;
}

function widgetUsesEquations(widget: Widget) {
  return widget.queries.some(query =>
    query.fields?.some(field => field.includes('equation|'))
  );
}

function widgetUsesPercentile(widget: Widget) {
  return widget.queries.some(query =>
    query.fields?.some(field => field.includes('percentile'))
  );
}
