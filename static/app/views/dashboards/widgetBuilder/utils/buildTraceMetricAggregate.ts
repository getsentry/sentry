import {defined} from 'sentry/utils/defined';
import type {
  AggregationKeyWithAlias,
  Column,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DisplayType} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {NONE_UNIT} from 'sentry/views/explore/metrics/constants';
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
      defined(traceMetric.unit) && traceMetric.unit !== '-'
        ? traceMetric.unit
        : NONE_UNIT,
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
      return {name, type, unit: defined(unit) && unit !== '-' ? unit : NONE_UNIT};
    }
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
