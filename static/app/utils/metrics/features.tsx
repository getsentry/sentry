import type {Organization} from 'sentry/types/organization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

export function hasMetricsExperimentalFeature(organization: Organization) {
  return organization.features.includes('custom-metrics-experimental');
}

export function hasCustomMetrics(organization: Organization) {
  return organization.features.includes('custom-metrics');
}

export function hasMetricAlertFeature(organization: Organization) {
  return organization.features.includes('incidents');
}

export function hasMetricsNewInputs(organization: Organization) {
  return organization.features.includes('metrics-new-inputs');
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
