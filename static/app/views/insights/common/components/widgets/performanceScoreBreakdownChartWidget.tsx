import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {decodeList} from 'sentry/utils/queryString';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import {WebVitalsWeightList} from 'sentry/views/insights/browser/webVitals/components/charts/webVitalWeightList';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';
import decodeBrowserTypes from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {InsightsTimeSeriesWidget} from 'sentry/views/insights/common/components/insightsTimeSeriesWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {SpanFields} from 'sentry/views/insights/types';

export default function PerformanceScoreBreakdownChartWidget(
  props: LoadableChartWidgetProps
) {
  const {
    transaction,
    [SpanFields.BROWSER_NAME]: browserTypes,
    [SpanFields.USER_GEO_SUBREGION]: subregions,
  } = useLocationQuery({
    fields: {
      [SpanFields.BROWSER_NAME]: decodeBrowserTypes,
      [SpanFields.USER_GEO_SUBREGION]: decodeList,
      transaction: decodeList,
    },
  });
  const search = new MutableSearch(
    `${DEFAULT_QUERY_FILTER} has:measurements.score.total`
  );

  if (transaction.length && transaction[0]) {
    search.addFilterValue('transaction', transaction[0]);
  }

  if (subregions) {
    search.addDisjunctionFilterValues(SpanFields.USER_GEO_SUBREGION, subregions);
  }

  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanFields.BROWSER_NAME, browserTypes);
  }

  const {
    data: vitalScoresData,
    isLoading: areVitalScoresLoading,
    error: vitalScoresError,
  } = useFetchSpanTimeSeries(
    {
      sampling: SAMPLING_MODE.HIGH_ACCURACY,
      interval: '12h',
      query: search,
      yAxis: [
        'performance_score(measurements.score.lcp)',
        'performance_score(measurements.score.fcp)',
        'performance_score(measurements.score.cls)',
        'performance_score(measurements.score.inp)',
        'performance_score(measurements.score.ttfb)',
        'count()',
      ],
      pageFilters: props.pageFilters,
    },
    'api.insights.web-vitals.timeseries-scores2'
  );

  const timeSeries = vitalScoresData?.timeSeries || [];
  const webVitalsThatHaveData: WebVitals[] = vitalScoresData
    ? ORDER.filter(webVital => {
        const key = `performance_score(measurements.score.${webVital})` as const;
        const series = timeSeries.find(ts => ts.yAxis === key);

        return series ? series.values.some(datum => (datum.value || 0) > 0) : false;
      })
    : [];

  const weights = getWeights(webVitalsThatHaveData);

  const allSeries: TimeSeries[] = vitalScoresData?.timeSeries
    ? ORDER.map(webVital => {
        const key = `performance_score(measurements.score.${webVital})` as const;
        const series = timeSeries.find(ts => ts.yAxis === key);

        if (!series) return null;

        return {
          ...series,
          meta: {
            ...series.meta,
            // TODO: The backend doesn't return these score fields with the "score" type yet. Fill this in manually for now.
            valueType: 'score' as const,
          },
          values: series.values.map(item => ({
            ...item,
            value: (item.value ?? 0) * weights[webVital],
          })),
        };
      }).filter(defined)
    : [];

  return (
    <InsightsTimeSeriesWidget
      {...props}
      id="performanceScoreBreakdownChartWidget"
      title={t('Score Breakdown')}
      height="100%"
      visualizationType="area"
      isLoading={areVitalScoresLoading}
      error={vitalScoresError}
      timeSeries={allSeries}
      description={<WebVitalsWeightList weights={weights} />}
    />
  );
}
