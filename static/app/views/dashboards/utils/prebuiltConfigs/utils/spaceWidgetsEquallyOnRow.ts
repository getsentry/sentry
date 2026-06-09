import {NUM_DESKTOP_COLS} from 'sentry/views/dashboards/constants';
import type {Widget} from 'sentry/views/dashboards/types';
import type {WidgetLayout} from 'sentry/views/dashboards/typesBase';
import type {
  PrebuiltWidget,
  PrebuiltWidgetLayout,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export function spaceWidgetsEquallyOnRow(
  widgets: Widget[],
  y: number,
  height: Pick<WidgetLayout, 'h' | 'minH'> = {h: 2, minH: 2}
): PrebuiltWidget[] {
  if (widgets.length > NUM_DESKTOP_COLS) {
    throw new Error(
      `Expected no more than ${NUM_DESKTOP_COLS} widgets, got ${widgets.length}`
    );
  }

  if (widgets.length === 0) {
    return [];
  }

  const widgetWidth = Math.floor(NUM_DESKTOP_COLS / widgets.length);

  // Casts are safe: the early-return above caps widgets.length at
  // NUM_DESKTOP_COLS, so widgetWidth in [1,6] and idx*widgetWidth in [0,5].
  return widgets.map((widget, idx) => ({
    ...widget,
    layout: {
      x: (idx * widgetWidth) as PrebuiltWidgetLayout['x'],
      y,
      w: widgetWidth as PrebuiltWidgetLayout['w'],
      ...height,
    },
  }));
}
