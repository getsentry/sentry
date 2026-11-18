import {defined} from 'sentry/utils/defined';
import {
  explodeFieldString,
  generateFieldAsString,
  type AggregationKeyWithAlias,
  type Column,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DisplayType} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/constants';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {NONE_UNIT} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {buildConditionalAggregate} from 'sentry/views/explore/utils/conditionalAggregate';
import {
  IF_SUFFIX,
  parseConditionalAggregate,
} from 'sentry/views/explore/utils/parseConditionalAggregate';

export interface TraceMetricFunctionParts {
  /**
   * Base aggregation name with any `_if` suffix removed.
   */
  aggregation: string;
  /**
   * Aggregate arguments in the `value, name, type, unit` order. The `_if`
   * filter argument is not included.
   */
  args: string[];
  /**
   * The `_if` filter, or an empty string when the aggregate has none.
   */
  filter: string;
}

/**
 * Splits a trace metric aggregate column into its base aggregation, its
 * metric arguments and its optional `_if` filter.
 */
export function getTraceMetricFunctionParts(
  column: Column
): TraceMetricFunctionParts | undefined {
  if (column.kind !== 'function') {
    return undefined;
  }

  if (!column.function[0].endsWith(IF_SUFFIX)) {
    const [aggregation, ...args] = column.function;
    return {aggregation, args: args.filter(defined), filter: ''};
  }

  const parsed = parseConditionalAggregate(generateFieldAsString(column));
  if (!parsed) {
    return undefined;
  }
  return {aggregation: parsed.name, args: parsed.arguments, filter: parsed.filter ?? ''};
}

export function buildTraceMetricAggregate(
  aggregation: AggregationKeyWithAlias,
  traceMetric: TraceMetric,
  filter = ''
): QueryFieldValue {
  const args = [
    'value',
    traceMetric.name,
    traceMetric.type,
    defined(traceMetric.unit) && traceMetric.unit !== '-' ? traceMetric.unit : NONE_UNIT,
  ];

  if (filter) {
    return explodeFieldString(
      buildConditionalAggregate({name: aggregation, arguments: args, filter})
    );
  }

  return {
    kind: 'function',
    function: [aggregation, args[0]!, ...args.slice(1)],
  };
}

/**
 * Sets (or clears, when `filter` is empty) the `_if` filter on a trace metric
 * aggregate column. Non-aggregate columns are returned unchanged.
 */
export function applyTraceMetricAggregateFilter(column: Column, filter: string): Column {
  const parts = getTraceMetricFunctionParts(column);
  if (!parts) {
    return column;
  }
  return explodeFieldString(
    buildConditionalAggregate({name: parts.aggregation, arguments: parts.args, filter}),
    column.alias
  );
}

/**
 * Extracts trace metric information from a Column that represents a trace metric aggregate.
 * Trace metric aggregates store the metric info in function args:
 *   function[0] = aggregation, function[1] = 'value',
 *   function[2] = name, function[3] = type, function[4] = unit
 * Aggregates carrying an `_if` filter store the filter first and shift the
 * metric info by one argument.
 */
export function extractTraceMetricFromColumn(column: Column): TraceMetric | undefined {
  const parts = getTraceMetricFunctionParts(column);
  if (!parts) {
    return undefined;
  }
  const [, name, type, unit] = parts.args;
  if (name && type) {
    return {name, type, unit: defined(unit) && unit !== '-' ? unit : NONE_UNIT};
  }
  return undefined;
}

/**
 * Returns the fields used to define a trace metric visualization's plotted data.
 *
 * Time-series visualizations plot their `yAxis` fields, while categorical bars
 * plot only aggregate and equation `fields`. All other display types use
 * `fields` directly; this deliberately includes table grouping fields alongside
 * aggregates so callers can preserve the complete table column configuration.
 *
 * Categorical bar visualizations use `fields` directly, but filter out grouping fields.
 */
export function getTraceMetricDisplayFields(
  displayType: DisplayType | undefined,
  yAxis: Column[] | undefined,
  fields: Column[] | undefined
): Column[] | undefined {
  if (usesTimeSeriesData(displayType)) {
    return yAxis;
  }
  if (displayType === DisplayType.CATEGORICAL_BAR) {
    return fields?.filter(
      f => f.kind === FieldValueKind.FUNCTION || f.kind === FieldValueKind.EQUATION
    );
  }
  return fields;
}

/**
 * Returns only aggregate and equation columns for Trace Metrics widgets.
 *
 * Tables store grouping fields alongside aggregates, while equation mode only
 * operates on aggregate columns.
 */
export function getTraceMetricAggregates(
  displayType: DisplayType | undefined,
  yAxis: Column[] | undefined,
  fields: Column[] | undefined
): Column[] | undefined {
  return getTraceMetricDisplayFields(displayType, yAxis, fields)?.filter(
    field =>
      field.kind === FieldValueKind.FUNCTION || field.kind === FieldValueKind.EQUATION
  );
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
