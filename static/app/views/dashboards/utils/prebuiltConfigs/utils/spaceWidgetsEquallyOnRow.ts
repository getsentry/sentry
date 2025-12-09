import type {Widget, WidgetLayout} from 'sentry/views/dashboards/types';

const MAX_WIDGETS_PER_ROW = 6;

export function spaceWidgetsEquallyOnRow(
  widgets: Widget[],
  y: number,
  height: Pick<WidgetLayout, 'h' | 'minH'> = {h: 2, minH: 2}
): Widget[] {
  if (widgets.length > MAX_WIDGETS_PER_ROW) {
    throw new Error(
      `Expected no more than ${MAX_WIDGETS_PER_ROW} widgets, got ${widgets.length}`
    );
  }

  const widgetWidth = Math.floor(MAX_WIDGETS_PER_ROW / widgets.length);

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
