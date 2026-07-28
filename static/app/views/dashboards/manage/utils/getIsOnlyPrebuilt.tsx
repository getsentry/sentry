import {DashboardFilter} from 'sentry/views/dashboards/types';

export function getIsOnlyPrebuilt(
  hasPrebuiltDashboards: boolean,
  urlFilter: DashboardFilter | undefined
): boolean {
  return hasPrebuiltDashboards && urlFilter === DashboardFilter.ONLY_PREBUILT;
}
