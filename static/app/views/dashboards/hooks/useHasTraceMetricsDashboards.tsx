import useOrganization from 'sentry/utils/useOrganization';

export function useHasTraceMetricsDashboards() {
  const organization = useOrganization();
  return organization.features.includes('tracemetrics-dashboards');
}
