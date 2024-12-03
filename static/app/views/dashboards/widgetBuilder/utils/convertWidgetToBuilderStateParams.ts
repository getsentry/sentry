import {DisplayType, type Widget, WidgetType} from 'sentry/views/dashboards/types';
import type {WidgetBuilderStateQueryParams} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

/**
 * Converts a widget to a set of query params that can be used to
 * restore the widget builder state.
 */
export function convertWidgetToBuilderStateParams(
  widget: Widget
): WidgetBuilderStateQueryParams {
  const yAxis = widget.queries.flatMap(q => q.aggregates);
  const field = widget.queries.flatMap(q => q.fields);
  const query = widget.queries.flatMap(q => q.conditions);

  return {
    title: widget.title,
    description: widget.description ?? '',
    dataset: widget.widgetType ?? WidgetType.ERRORS,
    displayType: widget.displayType ?? DisplayType.TABLE,
    field,
    yAxis,
    query,
  };
}
