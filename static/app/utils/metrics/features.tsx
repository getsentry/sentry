import type {Organization} from 'sentry/types';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

export function hasMetricsExperimentalFeature(organization: Organization) {
  return organization.features.includes('ddm-experimental');
}

export function hasMetricsUI(organization: Organization) {
  return organization.features.includes('ddm-ui');
}

export function hasDashboardImportFeature(organization: Organization) {
  return organization.features.includes('ddm-dashboard-import');
}

export function hasMetricsSidebarItem(organization: Organization) {
  return !organization.features.includes('ddm-sidebar-item-hidden');
}

export function hasCustomMetrics(organization: Organization) {
  return hasMetricsUI(organization) && hasMetricsSidebarItem(organization);
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
