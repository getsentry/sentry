import {OP_LABELS} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
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
      return 'This widget shows a timeseries chart. The aggregates are the y-axis metrics, columns are the group-by breakdowns, and conditions filter the data. Understand the intent from the query config below.';
    case DisplayType.TABLE:
      return 'This widget shows a table. The aggregates and columns define the visible fields, orderby is the sort, and conditions filter the data. Understand the intent from the query config below.';
    case DisplayType.BIG_NUMBER:
      return 'This widget shows a single number. The aggregate is the metric, conditions filter the data, and the current value is included below. Understand the intent from the query config below.';
    default:
      return 'This widget shows data. The aggregates, columns, and conditions define what is displayed. Understand the intent from the query config below.';
  }
}
