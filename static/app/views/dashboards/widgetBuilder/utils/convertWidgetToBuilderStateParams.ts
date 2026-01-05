import {explodeField, parseFunction} from 'sentry/utils/discover/fields';
import {
  DisplayType,
  WidgetType,
  type Widget,
  type WidgetQuery,
} from 'sentry/views/dashboards/types';
import {isChartDisplayType} from 'sentry/views/dashboards/utils';
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
  if (isChartDisplayType(widget.displayType)) {
    field = firstWidgetQuery ? stringifyFields(firstWidgetQuery, 'columns') : [];
  } else {
    // For TRACEMETRICS table/big_number widgets, use raw field strings directly
    // because stringifyFields loses the 4th argument (unit: "-")
    if (widget.widgetType === WidgetType.TRACEMETRICS && firstWidgetQuery?.fields) {
      field = firstWidgetQuery.fields;
    } else {
      field = firstWidgetQuery ? stringifyFields(firstWidgetQuery, 'fields') : [];
    }

    yAxis = [];
    legendAlias = [];
  }

  let traceMetric: TraceMetric | undefined = undefined;
  if (widget.widgetType === WidgetType.TRACEMETRICS) {
    const traceMetricReferenceAggregate = firstWidgetQuery?.aggregates[0];
    if (traceMetricReferenceAggregate) {
      const func = parseFunction(traceMetricReferenceAggregate);
      traceMetric = {
        name: func?.arguments?.[1] ?? '',
        type: func?.arguments?.[2] ?? '',
      };
    }
  }

  return {
    title: widget.title,
    description: widget.description ?? '',
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
  };
}
