import {explodeField} from 'sentry/utils/discover/fields';
import {
  DisplayType,
  WidgetType,
  type Widget,
  type WidgetQuery,
} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {getAxisRange} from 'sentry/views/dashboards/utils/axisRange';
import {extractTraceMetricFromWidget} from 'sentry/views/dashboards/utils/extractTraceMetricFromWidget';
import {
  serializeFields,
  serializeThresholds,
  serializeTraceMetric,
  type WidgetBuilderStateParams,
  type WidgetBuilderStateQueryParams,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

function stringifyFields(
  query: WidgetQuery,
  fieldKey: 'fields' | 'columns' | 'aggregates'
) {
  const fields = query[fieldKey]?.map((field, index) =>
    explodeField({field, alias: query.fieldAliases?.[index]})
  );
  return fields ? serializeFields(fields) : [];
}

/**
 * Converts a widget to URL query params for initializing the widget builder state.
 * Use convertWidgetToBuilderSetStateParams for SET_STATE dispatches that
 * need to carry some extra information for text widgets.
 */
export function convertWidgetToBuilderStateParams(
  widget: Widget
): WidgetBuilderStateQueryParams {
  const query = widget.queries.flatMap(q => q.conditions);
  const sort = widget.queries.flatMap(q => q.orderby);
  let legendAlias = widget.queries.flatMap(q => q.name);

  // y-axes and fields are shared across all queries
  // so we can just use the first query
  const firstWidgetQuery = widget.queries[0];
  let yAxis = firstWidgetQuery ? stringifyFields(firstWidgetQuery, 'aggregates') : [];
  let field: string[] = [];
  if (usesTimeSeriesData(widget.displayType)) {
    field = firstWidgetQuery ? stringifyFields(firstWidgetQuery, 'columns') : [];
  } else {
    field = firstWidgetQuery ? stringifyFields(firstWidgetQuery, 'fields') : [];

    yAxis = [];
    legendAlias = [];
  }

  let traceMetric: TraceMetric | null = null;
  if (widget.widgetType === WidgetType.TRACEMETRICS) {
    traceMetric = extractTraceMetricFromWidget(widget);
  }

  const description =
    widget.displayType === DisplayType.TEXT ? undefined : (widget.description ?? '');

  const dataset =
    widget.displayType === DisplayType.TEXT
      ? undefined
      : (widget.widgetType ?? WidgetType.ERRORS);

  return {
    title: widget.title,
    description,
    dataset,
    displayType: widget.displayType ?? DisplayType.TABLE,
    limit: widget.limit,
    field,
    yAxis,
    query,
    sort,
    legendAlias,
    selectedAggregate: firstWidgetQuery?.selectedAggregate,
    thresholds: widget.thresholds ? serializeThresholds(widget.thresholds) : undefined,
    traceMetric: traceMetric ? serializeTraceMetric(traceMetric) : undefined,
    axisRange: getAxisRange(widget.axisRange) ?? 'auto',
  };
}

/**
 * Converts a widget to SET_STATE params, including textContent for text widgets.
 * Use this when dispatching SET_STATE actions. This will carry all necessary information
 * needed for text widgets in addition to all other widgets.
 */
export function convertWidgetToBuilderState(widget: Widget): WidgetBuilderStateParams {
  const state = convertWidgetToBuilderStateParams(widget);
  if (widget.displayType === DisplayType.TEXT) {
    return {...state, textContent: widget.description};
  }
  return state;
}
