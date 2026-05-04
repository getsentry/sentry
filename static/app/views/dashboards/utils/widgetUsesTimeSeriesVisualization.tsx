import {DisplayType, type Widget} from 'sentry/views/dashboards/types';

const SUPPORTED_DISPLAY_TYPES = new Set<DisplayType>([
  DisplayType.LINE,
  DisplayType.AREA,
  DisplayType.BAR,
]);

export function widgetUsesTimeSeriesVisualization(widget: Widget): boolean {
  if (!widget.widgetType) {
    return false;
  }

  return SUPPORTED_DISPLAY_TYPES.has(widget.displayType);
}
