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
 * Converts a widget to a set of query params that can be used to
 * restore the widget builder state.
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
    widget.displayType === DisplayType.TEXT ? undefined : widget.description;

  return {
    title: widget.title,
    description,
    dataset: widget.widgetType ?? WidgetType.ERRORS,
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
