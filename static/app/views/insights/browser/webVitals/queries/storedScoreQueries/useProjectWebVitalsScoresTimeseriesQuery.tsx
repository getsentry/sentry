import type {SeriesDataUnit} from 'sentry/types/echarts';
import type {Tag} from 'sentry/types/group';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/browser/webVitals/referrers';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {SpanFields, type SubregionCode} from 'sentry/views/insights/types';

type Props = {
  browserTypes?: BrowserType[];
  enabled?: boolean;
  subregions?: SubregionCode[];
  tag?: Tag;
  transaction?: string | null;
  weighted?: boolean;
};

export type WebVitalsScoreBreakdown = {
  cls: SeriesDataUnit[];
  fcp: SeriesDataUnit[];
  inp: SeriesDataUnit[];
  lcp: SeriesDataUnit[];
  total: SeriesDataUnit[];
  ttfb: SeriesDataUnit[];
};

export const useProjectWebVitalsScoresTimeseriesQuery = ({
  transaction,
  tag,
  browserTypes,
  subregions,
}: Props) => {
  const search = new MutableSearch([
    'has:measurements.score.total',
    ...(tag ? [`${tag.key}:"${tag.name}"`] : []),
  ]);
  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  if (subregions) {
    search.addDisjunctionFilterValues(SpanFields.USER_GEO_SUBREGION, subregions);
  }
  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanFields.BROWSER_NAME, browserTypes);
  }

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

  return {...result, data};
};
