import {parseFunction} from 'sentry/utils/discover/fields';
import type {Widget} from 'sentry/views/dashboards/types';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

/**
 * Extracts TraceMetric information from a TRACEMETRICS widget's aggregates
 */
export function extractTraceMetricFromWidget(widget: Widget): TraceMetric | null {
  const firstQuery = widget.queries[0];
  if (!firstQuery?.aggregates || firstQuery.aggregates.length === 0) {
    return null;
  }

  // Parse the first aggregate to extract metric name and type
  // TRACEMETRICS aggregates are in format: avg(value,metric_name,metric_type,-)
  const firstAggregate = firstQuery.aggregates[0] ?? '';
  const parsedFunction = parseFunction(firstAggregate);

  if (!parsedFunction?.arguments || parsedFunction.arguments.length < 3) {
    return null;
  }

  const name = parsedFunction.arguments[1] ?? '';
  const type = parsedFunction.arguments[2] ?? '';
  const unit =
    parsedFunction.arguments[3] === '-' ? undefined : parsedFunction.arguments[3];

  return {name, type, unit};
}
