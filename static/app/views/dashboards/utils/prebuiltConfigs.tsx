import {type DashboardDetails} from 'sentry/views/dashboards/types';
import {QUERIES_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/queries';
import {SESSION_HEALTH_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/sessionHealth';

export enum PrebuiltDashboardId {
  FRONTEND_SESSION_HEALTH = 1,
  BACKEND_QUERIES = 2,
}

export type PrebuiltDashboard = Omit<DashboardDetails, 'id'>;

export const PREBUILT_DASHBOARDS: Record<PrebuiltDashboardId, PrebuiltDashboard> = {
  [PrebuiltDashboardId.FRONTEND_SESSION_HEALTH]: SESSION_HEALTH_PREBUILT_CONFIG,
  [PrebuiltDashboardId.BACKEND_QUERIES]: QUERIES_PREBUILT_CONFIG,
};
