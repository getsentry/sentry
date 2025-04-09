import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/cache/settings';
import {SpanFunction} from 'sentry/views/insights/types';

const {CACHE_MISS_RATE} = SpanFunction;

export function CacheMissRateWidget() {
  const {
    isPending: isCacheMissRateLoading,
    data: cacheMissRateData,
    error: cacheMissRateError,
  } = useSpanMetricsSeries(
    {
      yAxis: [`${CACHE_MISS_RATE}()`],
      search: MutableSearch.fromQueryObject(BASE_FILTERS),
      transformAliasToInputFormat: true,
    },
    Referrer.LANDING_CACHE_HIT_MISS_CHART
  );

  return (
    <InsightsLineChartWidget
      title={DataTitles[`cache_miss_rate()`]}
      series={[cacheMissRateData[`${CACHE_MISS_RATE}()`]]}
      isLoading={isCacheMissRateLoading}
      error={cacheMissRateError}
    />
  );
}
