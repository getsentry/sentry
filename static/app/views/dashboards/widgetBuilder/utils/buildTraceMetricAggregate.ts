import type {
  AggregationKeyWithAlias,
  Column,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

export function buildTraceMetricAggregate(
  aggregation: AggregationKeyWithAlias,
  traceMetric: TraceMetric
): QueryFieldValue {
  return {
    kind: 'function',
    function: [
      aggregation,
      'value',
      traceMetric.name,
      traceMetric.type,
      traceMetric.unit ?? '-',
    ],
  };
}

/**
 * Extracts trace metric information from a Column that represents a trace metric aggregate.
 * Trace metric aggregates store the metric info in function args:
 *   function[0] = aggregation, function[1] = 'value',
 *   function[2] = name, function[3] = type, function[4] = unit
 */
export function extractTraceMetricFromColumn(column: Column): TraceMetric | undefined {
  if (column.kind === 'function' && column.function) {
    const [, , name, type, unit] = column.function;
    if (name && type) {
      return {name, type, unit: unit === '-' ? undefined : unit};
    }
  }
  return undefined;
}
