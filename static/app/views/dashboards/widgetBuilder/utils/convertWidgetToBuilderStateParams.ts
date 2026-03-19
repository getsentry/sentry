import {explodeField} from 'sentry/utils/discover/fields';
import {
  DisplayType,
  WidgetType,
  type Widget,
  type WidgetQuery,
} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {getAxisRange} from 'sentry/views/dashboards/utils/axisRange';
import {
  serializeFields,
  serializeLinkedDashboards,
  serializeThresholds,
  type WidgetBuilderStateParams,
  type WidgetBuilderStateQueryParams,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

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
 * Converts a widget to URL query params to open the widget builder in the correct state.
 * Use `convertWidgetToBuilderSetStateParams` for `SET_STATE` dispatches as the URL
 * query params and widget builder state varies.
 */
export function convertWidgetToQueryParams(
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

  const isTextWidget = widget.displayType === DisplayType.TEXT;

  const description = isTextWidget ? undefined : (widget.description ?? '');

  const dataset = isTextWidget ? undefined : (widget.widgetType ?? WidgetType.ERRORS);

  const linkedDashboards = firstWidgetQuery?.linkedDashboards
    ? serializeLinkedDashboards(firstWidgetQuery.linkedDashboards)
    : undefined;

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
    linkedDashboards,
    selectedAggregate: firstWidgetQuery?.selectedAggregate,
    legendType: widget.legendType,
    thresholds: widget.thresholds ? serializeThresholds(widget.thresholds) : undefined,
    axisRange: getAxisRange(widget.axisRange) ?? 'auto',
  };
}

/**
 * Converts a widget to widget builder state.
 * Use this when dispatching SET_STATE actions. This will carry all information
 * (including non-url query params) needed to set the state for the widget builder UI.
 */
export function convertWidgetToBuilderState(widget: Widget): WidgetBuilderStateParams {
  // The state uses most of the same params as the query params
  const state = convertWidgetToQueryParams(widget);
  // add in the additional non-url query params
  if (widget.displayType === DisplayType.TEXT) {
    return {...state, textContent: widget.description};
  }
  return state;
}
