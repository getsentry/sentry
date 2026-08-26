import {defined} from 'sentry/utils/defined';
import {
  generateWidgetsAfterCompaction,
  getDefaultWidgetHeight,
} from 'sentry/views/dashboards/layoutUtils';
import type {Widget} from 'sentry/views/dashboards/types';

/**
 * Takes a series of widgets and ensures that the height assigned to each widget is the proper minimum height.
 */
export function enforceLayoutMinHeight(widgets: Widget[]): Widget[] {
  for (const widget of widgets) {
    const minWidgetHeight = getDefaultWidgetHeight(widget.displayType);
    if (defined(widget.layout?.h) && widget.layout.h < minWidgetHeight) {
      widget.layout.h = minWidgetHeight;
    }
  }
  return generateWidgetsAfterCompaction(widgets);
}
