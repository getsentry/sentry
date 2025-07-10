import type {SeriesDataUnit} from 'sentry/types/echarts';
import type {Tag} from 'sentry/types/group';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {SpanMetricsField, type SubregionCode} from 'sentry/views/insights/types';

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
    search.addDisjunctionFilterValues(SpanMetricsField.USER_GEO_SUBREGION, subregions);
  }
  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanMetricsField.BROWSER_NAME, browserTypes);
  }

  const result = useMetricsSeries(
    {
      search: [DEFAULT_QUERY_FILTER, search.formatString()].join(' ').trim(),
      yAxis: [
        'performance_score(measurements.score.lcp)',
        'performance_score(measurements.score.fcp)',
        'performance_score(measurements.score.cls)',
        'performance_score(measurements.score.inp)',
        'performance_score(measurements.score.ttfb)',
        'count()',
      ],
    },
    'api.performance.browser.web-vitals.timeseries-scores'
  );

  const multiplyBy100 = (data: SeriesDataUnit[]) =>
    data.map(({name, value}) => ({name, value: value * 100}));

  const data: WebVitalsScoreBreakdown = {
    lcp: multiplyBy100(result.data['performance_score(measurements.score.lcp)'].data),
    fcp: multiplyBy100(result.data['performance_score(measurements.score.fcp)'].data),
    cls: multiplyBy100(result.data['performance_score(measurements.score.cls)'].data),
    ttfb: multiplyBy100(result.data['performance_score(measurements.score.ttfb)'].data),
    inp: multiplyBy100(result.data['performance_score(measurements.score.inp)'].data),
    total: result.data['count()'].data,
  };

  return {...result, data};
};
