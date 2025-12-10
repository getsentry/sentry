import {NUM_DESKTOP_COLS} from 'sentry/views/dashboards/dashboard';
import type {Widget, WidgetLayout} from 'sentry/views/dashboards/types';

export function spaceWidgetsEquallyOnRow(
  widgets: Widget[],
  y: number,
  height: Pick<WidgetLayout, 'h' | 'minH'> = {h: 2, minH: 2}
): Widget[] {
  if (widgets.length > NUM_DESKTOP_COLS) {
    throw new Error(
      `Expected no more than ${NUM_DESKTOP_COLS} widgets, got ${widgets.length}`
    );
  }

  if (widgets.length === 0) {
    return [];
  }

  const widgetWidth = Math.floor(NUM_DESKTOP_COLS / widgets.length);

  return widgets.map((widget, idx) => ({
    ...widget,
    layout: {
      x: idx * widgetWidth,
      y,
      w: widgetWidth,
      ...height,
    },
  }));
}
