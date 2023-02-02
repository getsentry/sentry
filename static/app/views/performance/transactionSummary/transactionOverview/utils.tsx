import {Location} from 'history';

import {Organization} from 'sentry/types';
import {
  canUseMetricsData,
  MetricsEnhancedSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {decodeScalar} from 'sentry/utils/queryString';
import {getMEPQueryParams} from 'sentry/views/performance/landing/widgets/utils';
import {DisplayModes} from 'sentry/views/performance/transactionSummary/utils';

const DISPLAY_MAP_DENY_LIST = [DisplayModes.TREND];

export function canUseTransactionMetricsData(organization, location) {
  const isUsingMetrics = canUseMetricsData(organization);

  if (!isUsingMetrics) {
    return false;
  }

  const display = decodeScalar(
    location.query.display,
    DisplayModes.DURATION
  ) as DisplayModes;
  const breakdown = decodeScalar(location.query.breakdown, '');
  const query = decodeScalar(location.query.query, '');

  // certain charts aren't compatible with metrics
  if (DISPLAY_MAP_DENY_LIST.includes(display)) {
    return false;
  }

  // span op breakdown filters aren't compatible with metrics
  if (breakdown) {
    return false;
  }

  // in the short term, using any filter will force indexed event search
  if (query) {
    return false;
  }

  return true;
}

export function getTransactionMEPParamsIfApplicable(
  mepContext: MetricsEnhancedSettingContext,
  organization: Organization,
  location: Location
) {
  if (!organization.features.includes('performance-metrics-backed-transaction-summary')) {
    return undefined;
  }

  if (!canUseTransactionMetricsData(organization, location)) {
    return undefined;
  }

  return getMEPQueryParams(mepContext);
}
