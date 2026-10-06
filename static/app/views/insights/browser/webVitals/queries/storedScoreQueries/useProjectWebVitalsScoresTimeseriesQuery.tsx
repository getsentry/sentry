import type {SeriesDataUnit} from 'sentry/types/echarts';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/browser/webVitals/referrers';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';

export type WebVitalsScoreBreakdown = {
  cls: SeriesDataUnit[];
  fcp: SeriesDataUnit[];
  inp: SeriesDataUnit[];
  lcp: SeriesDataUnit[];
  total: SeriesDataUnit[];
  ttfb: SeriesDataUnit[];
};

export const useProjectWebVitalsScoresTimeseriesQuery = () => {
  const search = new MutableSearch(['has:measurements.score.total']);

  const result = useFetchSpanTimeSeries(
    {
      query: [DEFAULT_QUERY_FILTER, search.formatString()].join(' ').trim(),
      yAxis: [
        'performance_score(measurements.score.lcp)',
        'performance_score(measurements.score.fcp)',
        'performance_score(measurements.score.cls)',
        'performance_score(measurements.score.inp)',
        'performance_score(measurements.score.ttfb)',
        'count()',
      ],
    },
    Referrer.WEB_VITAL_TIMESERIES_SCORES
  );

  const multiplyBy100 = (data: SeriesDataUnit[]) =>
    data.map(({name, value}) => ({name, value: value * 100}));

  const timeSeries = result.data?.timeSeries || [];

  const getSeriesData = (yAxis: string) => {
    const series = timeSeries.find(ts => ts.yAxis === yAxis);
    return series
      ? series.values.map(v => ({name: v.timestamp, value: v.value || 0}))
      : [];
  };

  const data: WebVitalsScoreBreakdown = {
    lcp: multiplyBy100(getSeriesData('performance_score(measurements.score.lcp)')),
    fcp: multiplyBy100(getSeriesData('performance_score(measurements.score.fcp)')),
    cls: multiplyBy100(getSeriesData('performance_score(measurements.score.cls)')),
    ttfb: multiplyBy100(getSeriesData('performance_score(measurements.score.ttfb)')),
    inp: multiplyBy100(getSeriesData('performance_score(measurements.score.inp)')),
    total: getSeriesData('count()'),
  };

  return {data, isLoading: result.isLoading};
};
