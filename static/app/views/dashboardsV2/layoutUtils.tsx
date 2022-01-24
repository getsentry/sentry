import {Layout} from 'react-grid-layout';
import pickBy from 'lodash/pickBy';
import sortBy from 'lodash/sortBy';
import zip from 'lodash/zip';

import {defined} from 'sentry/utils';
import {uniqueId} from 'sentry/utils/guid';

import {ADD_WIDGET_BUTTON_DRAG_ID} from './addWidget';
import {NUM_DESKTOP_COLS} from './dashboard';
import {DisplayType, Widget} from './types';

export const DEFAULT_WIDGET_WIDTH = 2;

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

export function pickDefinedStoreKeys(layout: Layout): Partial<Layout> {
  return pickBy(layout, (value, key) => defined(value) && STORE_KEYS.includes(key));
}

export function getWidgetHeight(displayType: DisplayType): number {
  return displayType === DisplayType.BIG_NUMBER ? 1 : 2;
}

export function getNextAvailablePosition(layouts: Layout[]): {x: number; y: number} {
  function generateColumnDepths(): Array<number> {
    const depths = Array(NUM_DESKTOP_COLS).fill(0);

    // loop through every layout and for each x, record the max depth
    layouts
      .filter(({i}) => i !== ADD_WIDGET_BUTTON_DRAG_ID)
      .forEach(({x, w, y, h}) => {
        // Adjust the column depths for each column the widget takes up
        for (let col = x; col < x + w; col++) {
          depths[col] = Math.max(y + h, depths[col]);
        }
      });

    return depths;
  }

  const columnDepths = generateColumnDepths();
  const maxColumnDepth = Math.max(...columnDepths);
  // Match the width against the lowest points to find one that fits
  for (let currDepth = 0; currDepth <= maxColumnDepth; currDepth++) {
    for (let start = 0; start <= columnDepths.length - 2; start++) {
      if (columnDepths[start] > currDepth) {
        continue;
      }
      const end = start + 2;
      if (columnDepths.slice(start, end).every(val => val <= currDepth)) {
        return {x: start, y: currDepth};
      }
    }
  }
  return {x: 0, y: maxColumnDepth + 1};
}
