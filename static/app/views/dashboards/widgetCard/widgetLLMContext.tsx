import {DisplayType} from 'sentry/views/dashboards/types';

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
