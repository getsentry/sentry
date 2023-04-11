import {PinnedPageFilter} from 'sentry/types';

export type CoreUIEventParameters = {
  'number_drag_control.clicked': {};
  'page_filters.pin_click': {
    filter: PinnedPageFilter;
    pin: boolean;
  };
  'user_feedback.dialog_opened': {
    projects: string;
  };
  'user_feedback.docs_clicked': {
    projects: string;
  };
  'user_feedback.viewed': {
    projects: string;
  };
};

type CoreUIAnalyticsKey = keyof CoreUIEventParameters;

export const coreUIEventMap: Record<CoreUIAnalyticsKey, string | null> = {
  'number_drag_control.clicked': 'Number Drag Control: Clicked',
  'page_filters.pin_click': 'Page Filters: Pin Button Clicked',
  'user_feedback.docs_clicked': 'User Feedback Docs Clicked',
  'user_feedback.dialog_opened': 'User Feedback Dialog Opened',
  'user_feedback.viewed': null, // volume high
};
