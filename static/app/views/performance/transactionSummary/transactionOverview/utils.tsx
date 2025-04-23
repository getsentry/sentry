import type {Organization} from 'sentry/types/organization';
import type {DataUnit} from 'sentry/utils/discover/fields';
import type {MetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import type {MetricsEnhancedPerformanceDataContext} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import type {MetricsEnhancedSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
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

type EAPSeriesData = Record<string, DiscoverSeries>;
export function eapSeriesDataToTimeSeries(data: EAPSeriesData) {
  const timeSeries: TimeSeries[] = [];
  Object.entries(data).forEach(([key, value]) => {
    timeSeries.push({
      field: key,
      meta: {
        type: value.meta?.fields?.[key] ?? null,
        unit: value.meta?.units?.[key] as DataUnit,
      },
      values:
        value.data.map(item => ({
          timestamp: item.name.toString(),
          value: item.value,
        })) ?? [],
    });
  });

  return timeSeries;
}
