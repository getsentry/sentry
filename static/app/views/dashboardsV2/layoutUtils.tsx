import {Layout} from 'react-grid-layout';
import sortBy from 'lodash/sortBy';
import zip from 'lodash/zip';

import {defined} from 'sentry/utils';
import {uniqueId} from 'sentry/utils/guid';

import {NUM_DESKTOP_COLS} from './dashboard';
import {DisplayType, Widget} from './types';

const DEFAULT_WIDGET_WIDTH = 2;

const WIDGET_PREFIX = 'grid-item';

// Keys for grid layout values we track in the server
const STORE_KEYS = ['x', 'y', 'w', 'h', 'minW', 'maxW', 'minH', 'maxH'];

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
    y: Number.MAX_SAFE_INTEGER,
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

  const layoutWidgetPairs = zip(desktopLayout, widgets) as [Layout, Widget][];

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

/**
 * Reads the layout from an array of widgets.
 */
export function getDashboardLayout(widgets: Widget[]): Layout[] {
  return widgets
    .filter(({layout}) => defined(layout))
    .map(({layout, ...widget}) => ({
      ...(layout as Layout),
      i: constructGridItemKey(widget),
    }));
}

export function pickDefinedStoreKeys(value, key) {
  return defined(value) && STORE_KEYS.includes(key);
}
