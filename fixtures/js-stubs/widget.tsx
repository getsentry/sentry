import type {Widget as TWidget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';

export function Widget(params: Partial<TWidget> = {}): TWidget {
  return {
    displayType: DisplayType.LINE,
    interval: '1d',
    queries: [],
    title: 'Widget',
    ...params,
  };
}
