import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SUMMARY_DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/frontendAssets/settings';

export const FRONTEND_ASSETS_SUMMARY_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  filters: {},
  title: SUMMARY_DASHBOARD_TITLE,
  widgets: [],
};
