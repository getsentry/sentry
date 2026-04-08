import {DisplayType} from 'sentry/views/dashboards/types';

/**
 * Replace internal \uf00d-delimited wildcard operators with readable labels
 * so the Seer Explorer agent can understand widget filter conditions.
 *
 * All other query structure (AND, OR, parens, free text, comparison operators)
 * passes through unchanged since only wildcard operators use \uf00d markers.
 */
export function readableConditions(query: string): string {
  return query
    .replaceAll('\uf00dDoesNotContain\uf00d', ' does not contain ')
    .replaceAll('\uf00dDoesNotStartWith\uf00d', ' does not start with ')
    .replaceAll('\uf00dDoesNotEndWith\uf00d', ' does not end with ')
    .replaceAll('\uf00dContains\uf00d', ' contains ')
    .replaceAll('\uf00dStartsWith\uf00d', ' starts with ')
    .replaceAll('\uf00dEndsWith\uf00d', ' ends with ');
}

/**
 * Returns a hint for the Seer Explorer agent describing how to re-query this
 * widget's data using a tool call, if the user wants to dig deeper.
 */
export function getWidgetQueryLLMHint(displayType: DisplayType): string {
  switch (displayType) {
    case DisplayType.LINE:
    case DisplayType.AREA:
    case DisplayType.BAR:
      return 'To dig deeper into this widget, run a timeseries query using y_axes (aggregates) + group_by (columns) + query (conditions)';
    case DisplayType.TABLE:
      return 'To dig deeper into this widget, run a table query using fields (aggregates + columns) + query (conditions) + sort (orderby)';
    case DisplayType.BIG_NUMBER:
      return 'To dig deeper into this widget, run a single aggregate query using fields (aggregates) + query (conditions); current value is included below';
    default:
      return 'To dig deeper into this widget, run a table query using fields (aggregates + columns) + query (conditions)';
  }
}
