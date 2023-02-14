import {Location} from 'history';

import {Organization} from 'sentry/types';
import {
  canUseMetricsData,
  MetricsEnhancedSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {decodeScalar} from 'sentry/utils/queryString';
import {getMEPQueryParams} from 'sentry/views/performance/landing/widgets/utils';
import {DisplayModes} from 'sentry/views/performance/transactionSummary/utils';

export const DISPLAY_MAP_DENY_LIST = [DisplayModes.TREND, DisplayModes.LATENCY];

export function canUseTransactionMetricsData(organization, location) {
  const isUsingMetrics = canUseMetricsData(organization);

  if (!isUsingMetrics) {
    return false;
  }

  // span op breakdown filters aren't compatible with metrics
  const breakdown = decodeScalar(location.query.breakdown, '');
  if (breakdown) {
    return false;
  }

  // in the short term, using any filter will force indexed event search
  const query = decodeScalar(location.query.query, '');
  if (query) {
    return false;
  }

  return true;
}

export function getTransactionMEPParamsIfApplicable(
  mepContext: MetricsEnhancedSettingContext,
  organization: Organization,
  location: Location,
  unfiltered: boolean = false
) {
  if (!organization.features.includes('performance-metrics-backed-transaction-summary')) {
    return undefined;
  }

  if (!unfiltered && !canUseTransactionMetricsData(organization, location)) {
    return undefined;
  }

  return getMEPQueryParams(mepContext);
}
