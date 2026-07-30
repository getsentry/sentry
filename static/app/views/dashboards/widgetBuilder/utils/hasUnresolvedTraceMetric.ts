import {explodeField, isEquation} from 'sentry/utils/discover/fields';
import type {Widget} from 'sentry/views/dashboards/types';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';

/**
 * Whether any of a trace-metric widget's aggregates fail to resolve to a metric
 * (`fn(value, name, type, unit)`). This uses the same per-aggregate predicate the
 * metric selector's auto-select keys off (`extractTraceMetricFromColumn`), so it
 * also answers "is a metric about to be filled in?". Equations carry no metric
 * tuple and reference base aggregates validated on their own, so they're skipped.
 * Callers must confirm the trace-metrics dataset first.
 */
export function hasUnresolvedTraceMetric(widget: Widget): boolean {
  return widget.queries
    .flatMap(query => query.aggregates)
    .filter(aggregate => !isEquation(aggregate))
    .some(aggregate => !extractTraceMetricFromColumn(explodeField({field: aggregate})));
}
