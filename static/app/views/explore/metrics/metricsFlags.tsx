// Only add feature flag checks to this file to stop inadverent imports.
// Flags are from temporary.py

import type {Organization} from 'sentry/types/organization';

export const canUseMetricsUI = (organization: Organization) => {
  return organization.features.includes('tracemetrics-enabled');
};

export const canUseMetricsStatsUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) &&
    organization.features.includes('explore-dev-features')
  );
};

export const canUseMetricsSavedQueriesUI = (organization: Organization) => {
  return canUseMetricsUI(organization);
};

export const canUseMetricsAlertsUI = (organization: Organization) => {
  return canUseMetricsUI(organization);
};

export const canUseMetricsStatsBytesUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) &&
    organization.features.includes('tracemetrics-stats-bytes-ui')
  );
};

export const canUseMetricsEquationsInAlerts = (organization: Organization) => {
  return canUseMetricsAlertsUI(organization);
};

export const canUseMetricsPiiScrubbingUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) &&
    organization.features.includes('tracemetrics-pii-scrubbing-ui')
  );
};

export const canUseMetricsHeatMap = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) &&
    organization.features.includes('data-browsing-heat-map-widget')
  );
};
