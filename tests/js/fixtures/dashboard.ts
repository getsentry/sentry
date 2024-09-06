import type {
  DashboardDetails,
  DashboardFilters,
  DashboardListItem,
  Widget,
} from 'sentry/views/dashboards/types';

export function DashboardFixture(
  widgets: Widget[],
  props: Partial<DashboardDetails> = {}
): DashboardDetails {
  return {
    id: '1',
    filters: [] as DashboardFilters,
    dateCreated: new Date().toISOString(),
    projects: undefined,
    title: 'Dashboard',
    widgets,
    ...props,
  };
}

export function DashboardListItemFixture(
  params: Partial<DashboardListItem> = {}
): DashboardListItem {
  return {
    id: '1',
    title: 'Dashboard',
    widgetDisplay: [],
    widgetPreview: [],
    ...params,
  };
}
