import { WidgetQueryFixture } from 'sentry-fixture/widgetQuery';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';

export function WidgetFixture(params: Partial<Widget> = {}): Widget {
  return {
    displayType: DisplayType.LINE,
    interval: '1d',
    queries: [WidgetQueryFixture()],
    title: 'Widget',
    ...params,
  };
}
