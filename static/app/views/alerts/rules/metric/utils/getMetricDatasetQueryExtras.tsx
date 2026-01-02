import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {hasOnDemandMetricAlertFeature} from 'sentry/utils/onDemandMetrics/features';
import {decodeScalar} from 'sentry/utils/queryString';
import {
  Dataset,
  ExtrapolationMode,
  type MetricRule,
} from 'sentry/views/alerts/rules/metric/types';
import {shouldUseErrorsDiscoverDataset} from 'sentry/views/alerts/rules/utils';
import {getDiscoverDataset} from 'sentry/views/alerts/wizard/options';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function getMetricDatasetQueryExtras({
  organization,
  location,
  dataset,
  query,
  newAlertOrQuery,
  useOnDemandMetrics,
  traceItemType,
}: {
  dataset: MetricRule['dataset'];
  newAlertOrQuery: boolean;
  organization: Organization;
  extrapolationMode?: ExtrapolationMode;
  location?: Location;
  query?: string;
  traceItemType?: TraceItemDataset | null;
  useOnDemandMetrics?: boolean;
}) {
  if (
    dataset === Dataset.EVENTS_ANALYTICS_PLATFORM &&
    traceItemType === TraceItemDataset.LOGS
  ) {
    return {
      dataset: DiscoverDatasets.OURLOGS,
    };
  }

  if (dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
    return {
      dataset: DiscoverDatasets.SPANS,
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
    queryExtras.dataset = DiscoverDatasets.SPANS;
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
