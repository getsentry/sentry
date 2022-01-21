import {Layout} from 'react-grid-layout';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import sortBy from 'lodash/sortBy';
import zip from 'lodash/zip';

import {defined} from 'sentry/utils';
import {uniqueId} from 'sentry/utils/guid';

import {NUM_DESKTOP_COLS} from './dashboard';
import {DashboardDetails, DisplayType, Widget} from './types';

const DEFAULT_WIDGET_WIDTH = 2;

// Keys for grid layout values we track in the server
const STORE_KEYS = ['x', 'y', 'w', 'h', 'minW', 'maxW', 'minH', 'maxH'];

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

/**
 * Creates a new DashboardDetails object with the layouts associated with
 * widgets for outgoing requests.
 */
export function constructDashboardWidgetsWithLayout(
  dashboard: DashboardDetails,
  layout: Layout[]
): DashboardDetails {
  return {
    ...dashboard,
    widgets: dashboard.widgets.map(widget => {
      const matchingLayout = layout.find(({i}) => i === constructGridItemKey(widget));
      return {...widget, layout: pick(matchingLayout, STORE_KEYS)};
    }),
  };
}

export function isLayoutEqual(prevLayouts: Layout[], newLayouts: Layout[]): boolean {
  // Compares only defined keys we care about storing
  const normalizeLayout = layout => {
    const definedKeys = Object.keys(layout).filter(
      key => STORE_KEYS.includes(key) && defined(layout[key])
    );
    return pick(layout, definedKeys);
  };

  const prevLayoutNormalized = prevLayouts.map(normalizeLayout);
  const newLayoutNormalized = newLayouts.map(normalizeLayout);
  return isEqual(prevLayoutNormalized, newLayoutNormalized);
}
