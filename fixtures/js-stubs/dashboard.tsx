import {
  type DashboardDetails,
  type Widget as WidgetType,
} from 'sentry/views/dashboards/types';

import {User} from './user';
import {Widget} from './widget';

const DEFAULT_WIDGETS = [Widget()];

export function Dashboard(
  widgets: WidgetType[] = DEFAULT_WIDGETS,
  props: Partial<DashboardDetails> = {}
): DashboardDetails {
  return {
    id: '1',
    title: 'Dashboard',
    createdBy: User(),
    widgets,
    dateCreated: '',
    filters: {},
    projects: [],
    ...props,
  };
}
