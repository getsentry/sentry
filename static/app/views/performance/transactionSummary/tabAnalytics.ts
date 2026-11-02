import {Tab} from './tabs';

type TabEvents =
  | 'performance_views.events.events_tab_clicked'
  | 'performance_views.spans.spans_tab_clicked';

export const TAB_ANALYTICS: Partial<Record<Tab, TabEvents>> = {
  [Tab.EVENTS]: 'performance_views.events.events_tab_clicked',
};
