import type {Organization} from 'sentry/types/organization';

export function isMetricsEnabled(organization: Organization): boolean {
  return organization.features.includes('tracemetrics-enabled');
}

export function isMetricsReplaysEnabled(organization: Organization): boolean {
  return (
    isMetricsEnabled(organization) &&
    organization.features.includes('tracemetrics-replay-ui')
  );
}

export function isMetricsSaveAsQueryEnabled(organization: Organization): boolean {
  return (
    isMetricsEnabled(organization) &&
    organization.features.includes('tracemetrics-save-as-query')
  );
}

export function isMetricsDashboardsEnabled(organization: Organization): boolean {
  return (
    isMetricsEnabled(organization) &&
    organization.features.includes('tracemetrics-dashboards')
  );
}
