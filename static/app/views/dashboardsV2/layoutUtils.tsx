import {Layout} from 'react-grid-layout';
import sortBy from 'lodash/sortBy';
import zip from 'lodash/zip';

import {uniqueId} from 'sentry/utils/guid';

import {DEFAULT_WIDGET_WIDTH, NUM_DESKTOP_COLS} from './dashboard';
import {DisplayType, Widget} from './types';

const WIDGET_PREFIX = 'grid-item';

export function generateWidgetId(widget: Widget, index: number) {
  return widget.id ? `${widget.id}-index-${index}` : `index-${index}`;
}

export function constructGridItemKey(widget: Widget) {
  return `${WIDGET_PREFIX}-${widget.id ?? widget.tempId}`;
}

export function assignTempId(widget: Widget) {
  if (widget.id ?? widget.tempId) {
    return widget;
  }

  return {...widget, tempId: uniqueId()};
}

/**
 * Naive positioning for widgets assuming no resizes.
 */
export function getDefaultPosition(index: number, displayType: DisplayType) {
  return {
    x: (DEFAULT_WIDGET_WIDTH * index) % NUM_DESKTOP_COLS,
    y: Number.MAX_VALUE,
    w: DEFAULT_WIDGET_WIDTH,
    h: displayType === DisplayType.BIG_NUMBER ? 1 : 2,
    minH: displayType === DisplayType.BIG_NUMBER ? 1 : 2,
  };
}

export function getMobileLayout(desktopLayout: Layout[], widgets: Widget[]) {
  if (desktopLayout.length === 0) {
    // Initial case where the user has no layout saved, but
    // dashboard has widgets
    return [];
  }

  // If there's a layout but no matching widget, then the widget was deleted
  // in a separate session and should be ignored
  // TODO(nar): Can remove once layouts are stored in the DB
  const widgetGridKeys = new Set(widgets.map(constructGridItemKey));
  const filteredLayouts = desktopLayout.filter(({i}) => widgetGridKeys.has(i));

  const layoutWidgetPairs = zip(filteredLayouts, widgets) as [Layout, Widget][];

  // Sort by y and then subsort by x
  const sorted = sortBy(layoutWidgetPairs, ['0.y', '0.x']);

  const mobileLayout = sorted.map(([layout, widget], index) => ({
    ...layout,
    x: 0,
    y: index * 2,
    w: 2,
    h: widget.displayType === DisplayType.BIG_NUMBER ? 1 : 2,
  }));

  return mobileLayout;
}
