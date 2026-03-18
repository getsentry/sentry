import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {prettifyQueryConditions} from 'sentry/views/dashboards/utils/prettifyQueryConditions';

/**
 * Returns a legend label prefix for a widget query's series, or `undefined`
 * if no prefix is needed.
 *
 * When a query has a legend alias (`widgetQuery.name`),
 * `transformEventsResponseToSeries` already prefixes series names with it.
 * But when there are multiple queries and no alias, all queries produce
 * identically-named series (e.g., every query's series is just `"count()"`),
 * making the chart legend ambiguous. This function fills that gap by returning
 * the prettified query conditions as a prefix.
 *
 * This must be called in the widget query hooks (not in the visualization
 * component) because the hooks iterate per-query and know which query
 * produced each series. By the time series reach the visualization layer,
 * they're a flat array with no query association.
 */
export function getSeriesQueryPrefix(
  widgetQuery: WidgetQuery,
  widget: Widget
): string | undefined {
  if (widget.queries.length <= 1 || widgetQuery.name) {
    return undefined;
  }
  return prettifyQueryConditions(widgetQuery.conditions);
}
