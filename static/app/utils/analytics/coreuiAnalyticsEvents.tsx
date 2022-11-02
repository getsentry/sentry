import {PinnedPageFilter} from 'sentry/types';

export type CoreUIEventParameters = {
  'number_drag_control.clicked': {};
  'page_filters.pin_click': {
    filter: PinnedPageFilter;
    pin: boolean;
  };
};

type CoreUIAnalyticsKey = keyof CoreUIEventParameters;

export const coreUIEventMap: Record<CoreUIAnalyticsKey, string> = {
  'number_drag_control.clicked': 'Number Drag Control: Clicked',
  'page_filters.pin_click': 'Page Filters: Pin Button Clicked',
};
