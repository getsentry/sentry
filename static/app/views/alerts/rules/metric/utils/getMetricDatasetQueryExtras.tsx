import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
import {hasOnDemandMetricAlertFeature} from 'sentry/utils/onDemandMetrics/features';
import {decodeScalar} from 'sentry/utils/queryString';
import {getMEPAlertsDataset} from 'sentry/views/alerts/wizard/options';

import {Dataset, type MetricRule} from '../types';

export function getMetricDatasetQueryExtras({
  organization,
  location,
  dataset,
  newAlertOrQuery,
  useOnDemandMetrics,
}: {
  dataset: MetricRule['dataset'];
  newAlertOrQuery: boolean;
  organization: Organization;
  location?: Location;
  useOnDemandMetrics?: boolean;
}) {
  if (dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
    return {
      dataset: 'spans',
    };
  }

  const hasMetricDataset =
    hasOnDemandMetricAlertFeature(organization) ||
    hasCustomMetrics(organization) ||
    organization.features.includes('mep-rollout-flag') ||
    organization.features.includes('dashboards-metrics-transition');
  const disableMetricDataset =
    decodeScalar(location?.query?.disableMetricDataset) === 'true';

  const queryExtras: Record<string, string> = {};
  if (hasMetricDataset && !disableMetricDataset) {
    queryExtras.dataset = getMEPAlertsDataset(dataset, newAlertOrQuery);
  }
  if (location?.query?.aggregate?.includes('ai.total')) {
    queryExtras.dataset = 'spansMetrics';
    queryExtras.query = '';
  }

  if (useOnDemandMetrics) {
    queryExtras.useOnDemandMetrics = 'true';
  }

  return queryExtras;
}
