import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DataTitles, getDurationChartTitle, getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {BASE_FILTERS, FIELD_ALIASES} from 'sentry/views/insights/http/settings';

export type HTTPMetricType = 'throughput' | 'duration' | 'response-codes';

interface Props {
  metricType: HTTPMetricType;
  filters?: Record<string, any>;
  referrer?: string;
}

export function HTTPMetricsWidget({metricType, filters = {}, referrer}: Props) {
  const search = MutableSearch.fromQueryObject({
    ...BASE_FILTERS,
    ...filters,
  });

  const yAxis = {
    throughput: ['epm()'],
    duration: ['avg(span.self_time)'],
    'response-codes': ['http_response_rate(3)', 'http_response_rate(4)', 'http_response_rate(5)'],
  }[metricType];

  const {
    isPending: isDataLoading,
    data: metricsData,
    error: metricsError,
  } = useSpanMetricsSeries(
    {
      search,
      yAxis,
      transformAliasToInputFormat: true,
    },
    referrer ?? Referrer.LANDING_THROUGHPUT_CHART
  );

  const title = {
    throughput: getThroughputChartTitle('http'),
    duration: getDurationChartTitle('http'),
    'response-codes': DataTitles.unsuccessfulHTTPCodes,
  }[metricType];

  const series = {
    throughput: [metricsData['epm()']],
    duration: [metricsData['avg(span.self_time)']],
    'response-codes': [
      metricsData['http_response_rate(3)'],
      metricsData['http_response_rate(4)'],
      metricsData['http_response_rate(5)'],
    ],
  }[metricType];

  return (
    <InsightsLineChartWidget
      title={title}
      series={series}
      aliases={metricType === 'response-codes' ? FIELD_ALIASES : undefined}
      isLoading={isDataLoading}
      error={metricsError}
    />
  );
}
