import type {Organization} from 'sentry/types/organization';

export function hasOnDemandMetricAlertFeature(organization: Organization) {
  return organization.features.includes('on-demand-metrics-extraction');
}
