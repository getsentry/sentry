import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SUMMARY_DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/queues/settings';

export const QUEUE_SUMMARY_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: SUMMARY_DASHBOARD_TITLE,
  filters: {},
  widgets: [],
};
