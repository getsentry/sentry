import type {
  Widget as TWidget,
  WidgetQuery as TWidgetQuery,
} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';

export function Widget(queries: TWidgetQuery[], options: Partial<TWidget>): TWidget {
  return {
    displayType: DisplayType.LINE,
    interval: '1d',
    queries,
    title: 'Widget',
    ...options,
  };
}
