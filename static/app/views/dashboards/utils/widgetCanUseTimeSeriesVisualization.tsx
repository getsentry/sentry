import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';

const SUPPORTED_WIDGET_TYPES = new Set<WidgetType>([WidgetType.RELEASE]);

const SUPPORTED_DISPLAY_TYPES = new Set<DisplayType>([
  DisplayType.LINE,
  DisplayType.AREA,
  DisplayType.BAR,
]);

export function widgetCanUseTimeSeriesVisualization(widget: Widget): boolean {
  if (!widget.widgetType || !SUPPORTED_WIDGET_TYPES.has(widget.widgetType)) {
    return false;
  }

  if (!SUPPORTED_DISPLAY_TYPES.has(widget.displayType)) {
    return false;
  }

  return true;
}
