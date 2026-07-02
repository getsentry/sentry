import {DashboardsTab} from 'sentry/views/dashboards/manage/types';
import {DashboardFilter} from 'sentry/views/dashboards/types';

export function getDashboardsTab(
  hasPrebuiltDashboards: boolean,
  urlFilter: DashboardFilter | undefined
): DashboardsTab {
  if (!hasPrebuiltDashboards) {
    return DashboardsTab.CUSTOM;
  }
  if (urlFilter === DashboardFilter.ONLY_PREBUILT) {
    return DashboardsTab.PREBUILT;
  }
  if (urlFilter === DashboardFilter.ALL) {
    return DashboardsTab.ALL;
  }
  return DashboardsTab.CUSTOM;
}
