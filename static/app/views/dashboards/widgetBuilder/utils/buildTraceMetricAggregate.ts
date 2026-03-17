import type {
  AggregationKeyWithAlias,
  Column,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DisplayType} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {FieldValueKind} from 'sentry/views/discover/table/types';
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

/**
 * Finds the first function column in the list and extracts its trace metric info.
 */
export function extractTraceMetricFromAggregates(
  columns: Column[] | undefined
): TraceMetric | undefined {
  for (const column of columns ?? []) {
    const traceMetric = extractTraceMetricFromColumn(column);
    if (traceMetric) {
      return traceMetric;
    }
  }
  return undefined;
}

/**
 * Returns the aggregate columns for trace metric widgets based on display type.
 * Time-series uses yAxis, categorical bar filters to FUNCTION fields only,
 * and all other display types use fields directly.
 */
export function getTraceMetricAggregateSource(
  displayType: DisplayType | undefined,
  yAxis: Column[] | undefined,
  fields: Column[] | undefined
): Column[] | undefined {
  if (usesTimeSeriesData(displayType)) {
    return yAxis;
  }
  if (displayType === DisplayType.CATEGORICAL_BAR) {
    return fields?.filter(f => f.kind === FieldValueKind.FUNCTION);
  }
  return fields;
}

/**
 * Returns the appropriate dispatch action type for updating trace metric aggregates
 * based on the current display type.
 */
export function getTraceMetricAggregateActionType(displayType: DisplayType | undefined) {
  if (usesTimeSeriesData(displayType)) {
    return BuilderStateAction.SET_Y_AXIS;
  }
  if (displayType === DisplayType.CATEGORICAL_BAR) {
    return BuilderStateAction.SET_CATEGORICAL_AGGREGATE;
  }
  return BuilderStateAction.SET_FIELDS;
}
