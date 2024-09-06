import type {Organization} from 'sentry/types/organization';
import type {MetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import type {MetricsEnhancedPerformanceDataContext} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import type {MetricsEnhancedSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {getMEPQueryParams} from 'sentry/views/performance/landing/widgets/utils';

export function canUseTransactionMetricsData(
  organization: Organization,
  mepDataContext: MetricsEnhancedPerformanceDataContext
) {
  const isUsingMetrics = canUseMetricsData(organization);

  if (!isUsingMetrics) {
    return false;
  }

  if (mepDataContext.isMetricsData === false) {
    return false;
  }

  return true;
}

export function getTransactionMEPParamsIfApplicable(
  mepSetting: MetricsEnhancedSettingContext,
  mepCardinality: MetricsCardinalityContext,
  organization: Organization
) {
  if (!canUseMetricsData(organization)) {
    return undefined;
  }

  if (mepCardinality.outcome?.forceTransactionsOnly) {
    return undefined;
  }

  return getMEPQueryParams(mepSetting, true);
}
