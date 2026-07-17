import {DashboardsTab} from 'sentry/views/dashboards/manage/types';
import {DashboardFilter} from 'sentry/views/dashboards/types';

export function getDashboardsTab(
  hasPrebuiltDashboards: boolean,
  urlFilter: DashboardFilter | undefined
): DashboardsTab {
  if (hasPrebuiltDashboards && urlFilter === DashboardFilter.ONLY_PREBUILT) {
    return DashboardsTab.PREBUILT;
  }
  return DashboardsTab.ALL;
}
