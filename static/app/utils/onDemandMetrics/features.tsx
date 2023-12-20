import {Organization} from 'sentry/types';

export function hasOnDemandMetricAlertFeature(organization: Organization) {
  return organization.features.includes('on-demand-metrics-extraction');
}

export function shouldShowOnDemandMetricAlertUI(organization: Organization) {
  // we want to show the UI only for orgs that can create new on-demand metric alerts
  return (
    hasOnDemandMetricAlertFeature(organization) &&
    organization.features.includes('on-demand-metrics-ui')
  );
}

export function hasOnDemandMetricWidgetFeature(organization: Organization) {
  return (
    organization.features.includes('on-demand-metrics-extraction') &&
    organization.features.includes('on-demand-metrics-extraction-experimental')
  );
}
