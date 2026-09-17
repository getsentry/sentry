import {DashboardFilter} from 'sentry/views/dashboards/types';

export function getIsOnlyCustom(
  hasPrebuiltDashboards: boolean,
  urlFilter: DashboardFilter | undefined
): boolean {
  return hasPrebuiltDashboards && urlFilter === DashboardFilter.EXCLUDE_PREBUILT;
}
