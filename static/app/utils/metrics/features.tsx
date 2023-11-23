import type {Organization} from 'sentry/types';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

export function hasDdmAlertsSupport(organization: Organization) {
  return organization.features.includes('ddm-experimental');
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
  return hasDdmAlertsSupport(organization) && alertDataset === Dataset.GENERIC_METRICS
    ? {forceMetricsLayer: 'true'}
    : {};
}
