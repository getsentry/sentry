// Only add feature flag checks to this file to stop inadverent imports.

import type {Organization} from 'sentry/types/organization';

export const canUseMetricsUI = (organization: Organization) => {
  return organization.features.includes('tracemetrics-enabled');
};

export const canUseMetricsDashboardsUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) &&
    organization.features.includes('tracemetrics-dashboards')
  );
};

export const canUseMetricsDatascrubbingUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) &&
    organization.features.includes('tracemetrics-datascrubbing-ui')
  );
};

export const canUseMetricsExportUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) && organization.features.includes('tracemetrics-export')
  );
};

export const canUseMetricsReplayUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) &&
    organization.features.includes('tracemetrics-replay-ui')
  );
};

export const canUseMetricsSavedQueriesUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) &&
    organization.features.includes('tracemetrics-saved-queries')
  );
};

export const canUseMetricsStatsUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) && organization.features.includes('tracemetrics-stats')
  );
};

export const canUseMetricsTraceViewUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) &&
    organization.features.includes('tracemetrics-traceview-ui')
  );
};
