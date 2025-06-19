// TODO(release-drawer): Only used in cache/components/samplePanel

import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/cache/referrers';
// TODO(release-drawer): Only used in cache/components/samplePanel
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {SpanFields, SpanFunction} from 'sentry/views/insights/types';

type Props = {
  search: MutableSearch;
};

export function CacheHitMissChart({search}: Props) {
  const referrer = Referrer.SAMPLES_CACHE_HIT_MISS_CHART;

  const {
    data,
    isPending: isCacheHitRateLoading,
    error,
  } = useSpanMetricsSeries(
    {
      search,
      yAxis: [`${SpanFunction.CACHE_MISS_RATE}()`],
      transformAliasToInputFormat: true,
    },
    referrer
  );

  // explore/alerts doesn't support `cache_miss_rate`, so this is used as a comparable query
  const queryInfo = {
    yAxis: [`${SpanFunction.COUNT}(span.duration)`],
    search,
    groupBy: [SpanFields.CACHE_HIT],
    referrer,
  };

  return (
    <InsightsLineChartWidget
      queryInfo={queryInfo}
      title={DataTitles[`cache_miss_rate()`]}
      series={[data[`cache_miss_rate()`]]}
      showLegend="never"
      isLoading={isCacheHitRateLoading}
      error={error}
    />
  );
}
