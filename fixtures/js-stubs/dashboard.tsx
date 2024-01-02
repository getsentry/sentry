import type {
  DashboardDetails as TDashboardDetails,
  DashboardFilters as TDashboardFilters,
  DashboardListItem as TDashboardListItem,
  Widget as TWidget,
} from 'sentry/views/dashboards/types';

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
  params: Partial<TDashboardListItem> = {}
): TDashboardListItem {
  return {
    id: '1',
    title: 'Dashboard',
    widgetDisplay: [],
    widgetPreview: [],
    ...params,
  };
}
