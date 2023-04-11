import {PinnedPageFilter} from 'sentry/types';

interface DateSelector {
  field_changed: 'start' | 'end';
  path: string;
  time: string;
}

export type CoreUIEventParameters = {
  'dateselector.time_changed': DateSelector;
  'dateselector.utc_changed': {
    path: string;
    utc: boolean;
  };
  'environmentselector.direct_selection': {
    path: string;
  };
  'environmentselector.toggle': {
    action: 'removed' | 'added';
    path: string;
  };
  'environmentselector.update': {
    count: number;
    path: string;
  };
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
  'dateselector.utc_changed': null, // volume high
  'dateselector.time_changed': null, // volume high
  'environmentselector.toggle': null, // volume high
  'environmentselector.update': null, // volume high
  'environmentselector.direct_selection': null, // volume high
};
