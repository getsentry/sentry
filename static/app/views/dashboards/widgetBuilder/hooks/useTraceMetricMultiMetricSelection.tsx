import {useOrganization} from 'sentry/utils/useOrganization';

export function useTraceMetricMultiMetricSelection() {
  const organization = useOrganization();
  return organization.features.includes(
    'tracemetrics-multi-metric-selection-in-dashboards'
  );
}
