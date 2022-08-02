import {PinnedPageFilter} from 'sentry/types';

export type CoreUIEventParameters = {
  'page_filters.pin_click': {
    filter: PinnedPageFilter;
    pin: boolean;
  };
};

type CoreUIAnalyticsKey = keyof CoreUIEventParameters;

export const coreUIEventMap: Record<CoreUIAnalyticsKey, string> = {
  'page_filters.pin_click': 'Page Filters: Pin Button Clicked',
};
