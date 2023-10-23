import {Location} from 'history';

import {Organization} from 'sentry/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {getMEPAlertsDataset} from 'sentry/views/alerts/wizard/options';

import {MetricRule} from '../types';

export function getMetricDatasetQueryExtras({
  organization,
  location,
  dataset,
  newAlertOrQuery,
}: {
  dataset: MetricRule['dataset'];
  newAlertOrQuery: boolean;
  organization: Organization;
  location?: Location;
}) {
  const hasMetricDataset = organization.features.includes('mep-rollout-flag');
  const disableMetricDataset =
    decodeScalar(location?.query?.disableMetricDataset) === 'true';

  const queryExtras: Record<string, string> =
    hasMetricDataset && !disableMetricDataset
      ? {dataset: getMEPAlertsDataset(dataset, newAlertOrQuery)}
      : {};

  return queryExtras;
}
