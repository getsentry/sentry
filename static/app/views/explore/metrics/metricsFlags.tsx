// Only add feature flag checks to this file to stop inadverent imports.

import type {Organization} from 'sentry/types/organization';

export const canUseMetricsUI = (organization: Organization) => {
  return organization.features.includes('tracemetrics-enabled');
};

export const canUseMetricsStatsUI = (organization: Organization) => {
  return (
    canUseMetricsUI(organization) && organization.features.includes('tracemetrics-stats')
  );
};
