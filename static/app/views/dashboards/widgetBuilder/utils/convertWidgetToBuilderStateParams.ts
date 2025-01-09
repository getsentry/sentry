import {explodeField} from 'sentry/utils/discover/fields';
import {
  DisplayType,
  type Widget,
  type WidgetQuery,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {
  serializeFields,
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
  if (
    widget.displayType === DisplayType.TABLE ||
    widget.displayType === DisplayType.BIG_NUMBER
  ) {
    field = firstWidgetQuery ? stringifyFields(firstWidgetQuery, 'fields') : [];
    yAxis = [];
    legendAlias = [];
  } else {
    field = firstWidgetQuery ? stringifyFields(firstWidgetQuery, 'columns') : [];
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
  };
}
