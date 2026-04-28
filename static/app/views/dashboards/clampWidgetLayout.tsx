import {NUM_DESKTOP_COLS} from 'sentry/views/dashboards/constants';

import type {WidgetLayout} from './types';

/**
 * Clamps a widget layout so that dimensions stay within the dashboard grid bounds.
 * Widgets with w > NUM_DESKTOP_COLS or x + w > NUM_DESKTOP_COLS can cause an infinite
 * re-render loop in react-grid-layout when edit mode is enabled (DAIN-1225).
 */
export function clampWidgetLayout(layout: WidgetLayout): WidgetLayout {
  const w = Math.max(1, Math.min(layout.w, NUM_DESKTOP_COLS));
  const x = Math.max(0, Math.min(layout.x, NUM_DESKTOP_COLS - 1));
  const clampedW = Math.min(w, NUM_DESKTOP_COLS - x);

  return {...layout, w: clampedW, x};
}
