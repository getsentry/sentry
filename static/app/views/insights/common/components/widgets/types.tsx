import type {PageFilters} from 'sentry/types/core';

/**
 * These props are common across components that are required to dynamically
 * render an Insight Chart Widget
 */
export interface LoadableChartWidgetProps {
  // TODO(billy): This should be required when all chart widgets are converted
  /**
   * Unique ID for the widget
   */
  id?: string;

  /**
   * PageFilters-like object that will override the main PageFilters e.g. in
   * Releases Drawer, we have a smaller timeframe to show a smaller amount of
   * releases.
   */
  pageFilters?: PageFilters;

  /**
   * Show releases as either lines per release or a bubble for a group of releases.
   */
  showReleaseAs?: 'bubble' | 'line';
}
