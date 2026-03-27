// Only add feature flag checks to this file to stop inadverent imports.
// Flags are from temporary.py

import type {Organization} from 'sentry/types/organization';

export const canUseMetricsUI = (organization: Organization) => {
  return organization.features.includes('tracemetrics-enabled');
};

export const canUseMetricsStatsUI = (organization: Organization) => {
  return canUseMetricsUI(organization);
};

export const canUseMetricsSavedQueriesUI = (organization: Organization) => {
  return canUseMetricsUI(organization);
};

export const canUseMetricsAlertsUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) && organization.features.includes('tracemetrics-alerts')
  );
};

export const canUseMetricsSidePanelUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) &&
    organization.features.includes('tracemetrics-attributes-dropdown-side-panel')
  );
};

export const canUseMetricsUIRefresh = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) &&
    organization.features.includes('tracemetrics-ui-refresh')
  );
};

export const canUseMetricsStatsBytesUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) &&
    organization.features.includes('tracemetrics-stats-bytes-ui')
  );
};
