import type {
  DashboardDetails as TDashboardDetails,
  DashboardFilters as TDashboardFilters,
  DashboardListItem as TDashboardListItem,
  Widget as TWidget,
} from 'sentry/views/dashboards/types';

import {User} from './user';

export function Dashboard(
  widgets: TWidget[],
  props: Partial<TDashboardDetails> = {}
): TDashboardDetails {
  return {
    id: '1',
    filters: [] as TDashboardFilters,
    dateCreated: new Date().toISOString(),
    projects: undefined,
    title: 'Dashboard',
    widgets,
    ...props,
  };
}

export function DashboardListItem(
  props?: Partial<TDashboardListItem>
): TDashboardListItem {
  return {
    id: '1',
    title: 'Dashboard',
    widgetDisplay: [],
    widgetPreview: [],
    dateCreated: '2022-04-28T18:27:43.096451Z',
    createdBy: User(),
    ...props,
  };
}
