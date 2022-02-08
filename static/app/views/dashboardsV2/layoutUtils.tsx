import {Layout} from 'react-grid-layout';
import {compact} from 'react-grid-layout/build/utils';
import pickBy from 'lodash/pickBy';
import sortBy from 'lodash/sortBy';
import zip from 'lodash/zip';

import {defined} from 'sentry/utils';
import {uniqueId} from 'sentry/utils/guid';

import {NUM_DESKTOP_COLS} from './dashboard';
import {DisplayType, Widget, WidgetLayout} from './types';

export const DEFAULT_WIDGET_WIDTH = 2;

const WIDGET_PREFIX = 'grid-item';

// Keys for grid layout values we track in the server
const STORE_KEYS = ['x', 'y', 'w', 'h', 'minW', 'maxW', 'minH', 'maxH'];

export type Position = Pick<Layout, 'x' | 'y'>;

type NextPosition = [position: Position, columnDepths: number[]];

export function generateWidgetId(widget: Widget, index: number) {
  return widget.id ? `${widget.id}-index-${index}` : `index-${index}`;
}

export function constructGridItemKey(widget: {id?: string; tempId?: string}) {
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
  type WidgetWithDefinedLayout = Omit<Widget, 'layout'> & {layout: WidgetLayout};
  return widgets
    .filter((widget): widget is WidgetWithDefinedLayout => defined(widget.layout))
    .map(({layout, ...widget}) => ({
      ...layout,
      i: constructGridItemKey(widget),
    }));
}

export function pickDefinedStoreKeys(layout: Layout): WidgetLayout {
  // TODO(nar): Fix the types here
  return pickBy(
    layout,
    (value, key) => defined(value) && STORE_KEYS.includes(key)
  ) as WidgetLayout;
}

export function getDefaultWidgetHeight(displayType: DisplayType): number {
  return displayType === DisplayType.BIG_NUMBER ? 1 : 2;
}

export function getInitialColumnDepths() {
  return Array(NUM_DESKTOP_COLS).fill(0);
}

/**
 * Creates an array from layouts where each column stores how deep it is.
 */
export function calculateColumnDepths(
  layouts: Pick<Layout, 'h' | 'w' | 'x' | 'y'>[]
): number[] {
  const depths = getInitialColumnDepths();

  // For each layout's x, record the max depth
  layouts.forEach(({x, w, y, h}) => {
    // Adjust the column depths for each column the widget takes up
    for (let col = x; col < x + w; col++) {
      depths[col] = Math.max(y + h, depths[col]);
    }
  });

  return depths;
}

/**
 * Find the next place to place a widget and also returns the next
 * input when this operation needs to be called multiple times.
 *
 * @param columnDepths A profile of how deep the widgets in a column extend.
 * @param height The desired height of the next widget we want to place.
 * @returns An {x, y} positioning for the next available spot, as well as the
 * next columnDepths array if this position were used.
 */
export function getNextAvailablePosition(
  initialColumnDepths: number[],
  height: number
): NextPosition {
  const columnDepths = [...initialColumnDepths];
  const maxColumnDepth = Math.max(...columnDepths);

  // Look for an opening at each depth by scanning from 0, 0
  // By scanning from 0 depth to the highest depth, we ensure
  // we get the top-most available spot
  for (let currDepth = 0; currDepth <= maxColumnDepth; currDepth++) {
    for (let start = 0; start <= columnDepths.length - DEFAULT_WIDGET_WIDTH; start++) {
      if (columnDepths[start] > currDepth) {
        // There are potentially widgets in the way here, so skip
        continue;
      }

      // If all of the columns from start to end (the size of the widget)
      // have at most the current depth, then we've found a valid positioning
      // No other widgets extend into the space we need
      const end = start + DEFAULT_WIDGET_WIDTH;
      if (columnDepths.slice(start, end).every(val => val <= currDepth)) {
        for (let col = start; col < start + DEFAULT_WIDGET_WIDTH; col++) {
          columnDepths[col] = currDepth + height;
        }
        return [{x: start, y: currDepth}, [...columnDepths]];
      }
    }
  }

  for (let col = 0; col < DEFAULT_WIDGET_WIDTH; col++) {
    columnDepths[col] = maxColumnDepth;
  }
  return [{x: 0, y: maxColumnDepth}, [...columnDepths]];
}

export function assignDefaultLayout<T extends Pick<Widget, 'displayType' | 'layout'>>(
  widgets: T[],
  initialColumnDepths: number[]
): T[] {
  let columnDepths = [...initialColumnDepths];
  const newWidgets = widgets.map(widget => {
    if (defined(widget.layout)) {
      return widget;
    }
    const height = getDefaultWidgetHeight(widget.displayType);
    const [nextPosition, nextColumnDepths] = getNextAvailablePosition(
      columnDepths,
      height
    );
    columnDepths = nextColumnDepths;

    return {
      ...widget,
      layout: {...nextPosition, h: height, minH: height, w: DEFAULT_WIDGET_WIDTH},
    };
  });
  return newWidgets;
}

export function enforceWidgetHeightValues(widget: Widget): Widget {
  const {displayType, layout} = widget;
  const nextWidget = {
    ...widget,
  };
  if (!defined(layout)) {
    return nextWidget;
  }

  const minH = getDefaultWidgetHeight(displayType);
  const nextLayout = {
    ...layout,
    h: Math.max(layout?.h ?? minH, minH),
    minH,
  };
  return {...nextWidget, layout: nextLayout};
}

export function generateWidgetsAfterCompaction(widgets: Widget[]) {
  // Resolves any potential compactions that need to occur after a
  // single widget change would affect other widget positions, e.g. deletion
  const nextLayout = compact(getDashboardLayout(widgets), 'vertical', NUM_DESKTOP_COLS);
  return widgets.map(widget => {
    const layout = nextLayout.find(({i}) => i === constructGridItemKey(widget));
    if (!layout) {
      return widget;
    }
    return {...widget, layout};
  });
}
