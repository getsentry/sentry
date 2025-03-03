import {DisplayType, type Widget} from 'sentry/views/dashboards/types';

/**
 * Top Events for widgets is defined as a timeseries chart
 * with a grouping and a limit.
 */
export function getTopEvents(widget: Widget) {
  return widget.displayType !== DisplayType.TABLE &&
    widget.displayType !== DisplayType.BIG_NUMBER &&
    widget.queries[0]?.columns.length &&
    widget.queries[0]?.columns.length > 0
    ? widget.limit
    : undefined;
}
