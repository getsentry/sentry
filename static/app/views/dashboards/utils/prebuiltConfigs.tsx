import {type DashboardDetails} from 'sentry/views/dashboards/types';
import {HTTP_DOMAIN_SUMMARY_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/http/domainSummary';
import {HTTP_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/http/http';
import {QUERIES_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/queries/queries';
import {QUERIES_SUMMARY_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/queries/querySummary';
import {SESSION_HEALTH_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/sessionHealth';

export enum PrebuiltDashboardId {
  FRONTEND_SESSION_HEALTH = 1,
  BACKEND_QUERIES = 2,
  BACKEND_QUERIES_SUMMARY = 3,
  HTTP = 4,
  HTTP_DOMAIN_SUMMARY = 5,
}

export type PrebuiltDashboard = Omit<DashboardDetails, 'id'>;

export const PREBUILT_DASHBOARDS: Record<PrebuiltDashboardId, PrebuiltDashboard> = {
  [PrebuiltDashboardId.FRONTEND_SESSION_HEALTH]: SESSION_HEALTH_PREBUILT_CONFIG,
  [PrebuiltDashboardId.BACKEND_QUERIES]: QUERIES_PREBUILT_CONFIG,
  [PrebuiltDashboardId.BACKEND_QUERIES_SUMMARY]: QUERIES_SUMMARY_PREBUILT_CONFIG,
  [PrebuiltDashboardId.HTTP]: HTTP_PREBUILT_CONFIG,
  [PrebuiltDashboardId.HTTP_DOMAIN_SUMMARY]: HTTP_DOMAIN_SUMMARY_PREBUILT_CONFIG,
};
