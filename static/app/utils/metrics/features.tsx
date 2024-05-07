import type {Organization} from 'sentry/types/organization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

export function hasMetricsExperimentalFeature(organization: Organization) {
  return organization.features.includes('custom-metrics-experimental');
}

export function hasMetricsSidebarItem(organization: Organization) {
  return !organization.features.includes('ddm-sidebar-item-hidden');
}

export function hasCustomMetrics(organization: Organization) {
  return (
    organization.features.includes('custom-metrics') &&
    hasMetricsSidebarItem(organization)
  );
}

export function hasMetricStats(organization: Organization) {
  return (
    hasCustomMetrics(organization) && organization.features.includes('metrics-stats')
  );
}

/**
 * Returns the forceMetricsLayer query param for the alert
 * wrapped in an object so it can be spread into existing query params
 * @param organization current organization
 * @param alertDataset dataset of the alert
 */
export function getForceMetricsLayerQueryExtras(
  organization: Organization,
  alertDataset: Dataset
): {forceMetricsLayer: 'true'} | Record<string, never> {
  return hasCustomMetrics(organization) && alertDataset === Dataset.GENERIC_METRICS
    ? {forceMetricsLayer: 'true'}
    : {};
}
