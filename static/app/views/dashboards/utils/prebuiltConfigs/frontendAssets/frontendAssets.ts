import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/frontendAssets/settings';

export const FRONTEND_ASSETS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  filters: {},
  title: DASHBOARD_TITLE,
  widgets: [],
};
