import {OP_LABELS} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';

/**
 * Replace internal \uf00d-delimited wildcard operators with readable labels
 * so the Seer Explorer agent can understand widget filter conditions.
 *
 * All other query structure (AND, OR, parens, free text, comparison operators)
 * passes through unchanged since only wildcard operators use \uf00d markers.
 */
export function readableConditions(query: string): string {
  return Object.entries(OP_LABELS)
    .filter(([key]) => key.includes('\uf00d'))
    .reduce((s, [key, label]) => s.replaceAll(key, ` ${label} `), query);
}

/**
 * Returns a hint for the Seer Explorer agent describing what this widget
 * visualizes so it can understand the intent from the query config.
 */
export function getWidgetQueryLLMHint(displayType: DisplayType): string {
  switch (displayType) {
    case DisplayType.LINE:
    case DisplayType.AREA:
    case DisplayType.BAR:
      return 'This widget shows a timeseries chart. The aggregates are the y-axis metrics, columns are the group-by breakdowns, and conditions filter the data. Understand the intent from the query config in each widget. Use telemetry_live_search or telemetry_index_list_nodes to fetch data.';
    case DisplayType.TABLE:
      return 'This widget shows a table. The aggregates and columns define the visible fields, orderby is the sort, and conditions filter the data. Understand the intent from the query config in each widget. Use telemetry_live_search or telemetry_index_list_nodes to fetch data.';
    case DisplayType.BIG_NUMBER:
      return 'This widget shows a single number. The aggregate is the metric, conditions filter the data, and the current value is included in each widget. Use telemetry_live_search or telemetry_index_list_nodes to fetch data.';
    default:
      return 'This widget shows data. The aggregates, columns, and conditions define what is displayed. Understand the intent from the query config in each widget. Use telemetry_live_search or telemetry_index_list_nodes to fetch data.';
  }
}

/**
 * Build a legend mapping each display type present in the dashboard to its
 * query hint. This lives on the dashboard node so hints aren't repeated on
 * every widget.
 */
export function getQueryHintLegend(widgets: Widget[]): Record<string, string> {
  const resolved = widgets.map(w =>
    w.displayType === DisplayType.TOP_N ? DisplayType.AREA : w.displayType
  );
  const uniqueTypes = new Set(resolved);
  return Object.fromEntries([...uniqueTypes].map(dt => [dt, getWidgetQueryLLMHint(dt)]));
}
