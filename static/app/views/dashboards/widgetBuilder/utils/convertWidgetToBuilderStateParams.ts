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
  let yAxis = widget.queries.flatMap(q => q.aggregates);
  const query = widget.queries.flatMap(q => q.conditions);
  const sort = widget.queries.flatMap(q => q.orderby);
  let legendAlias = widget.queries.flatMap(q => q.name);

  let field: string[] = [];
  if (
    widget.displayType === DisplayType.TABLE ||
    widget.displayType === DisplayType.BIG_NUMBER
  ) {
    field = widget.queries.flatMap(widgetQuery => stringifyFields(widgetQuery, 'fields'));
    yAxis = [];
    legendAlias = [];
  } else {
    field = widget.queries.flatMap(widgetQuery =>
      stringifyFields(widgetQuery, 'columns')
    );
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
  };
}
