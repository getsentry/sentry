import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {hasOnDemandMetricAlertFeature} from 'sentry/utils/onDemandMetrics/features';
import {decodeScalar} from 'sentry/utils/queryString';
import {shouldUseErrorsDiscoverDataset} from 'sentry/views/alerts/rules/utils';
import {getDiscoverDataset} from 'sentry/views/alerts/wizard/options';

import {Dataset, type MetricRule} from '../types';

export function getMetricDatasetQueryExtras({
  organization,
  location,
  dataset,
  query,
  newAlertOrQuery,
  useOnDemandMetrics,
}: {
  dataset: MetricRule['dataset'];
  newAlertOrQuery: boolean;
  organization: Organization;
  location?: Location;
  query?: string;
  useOnDemandMetrics?: boolean;
}) {
  if (dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
    return {
      dataset: DiscoverDatasets.SPANS_EAP,
    };
  }

  const hasMetricDataset =
    hasOnDemandMetricAlertFeature(organization) ||
    organization.features.includes('mep-rollout-flag') ||
    organization.features.includes('dashboards-metrics-transition');
  const disableMetricDataset =
    decodeScalar(location?.query?.disableMetricDataset) === 'true';

  const queryExtras: Record<string, string> = {};
  if (hasMetricDataset && !disableMetricDataset) {
    queryExtras.dataset = getDiscoverDataset(dataset, newAlertOrQuery);
  }
  if (location?.query?.aggregate?.includes('ai.total')) {
    queryExtras.dataset = DiscoverDatasets.SPANS_METRICS;
    queryExtras.query = '';
  }

  if (useOnDemandMetrics) {
    queryExtras.useOnDemandMetrics = 'true';
  }

  if (shouldUseErrorsDiscoverDataset(query ?? '', dataset, organization)) {
    queryExtras.dataset = DiscoverDatasets.ERRORS;
  }

  return queryExtras;
}
