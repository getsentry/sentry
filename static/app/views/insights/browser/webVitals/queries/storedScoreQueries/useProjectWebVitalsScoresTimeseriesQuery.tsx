import type {SeriesDataUnit} from 'sentry/types/echarts';
import type {Tag} from 'sentry/types/group';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useDefaultWebVitalsQuery} from 'sentry/views/insights/browser/webVitals/utils/useDefaultQuery';
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
  const defaultQuery = useDefaultWebVitalsQuery();

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
      search: [defaultQuery, search.formatString()].join(' ').trim(),
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

  const data: WebVitalsScoreBreakdown = {
    lcp: [],
    fcp: [],
    cls: [],
    ttfb: [],
    inp: [],
    total: [],
  };

  if (result?.data) {
    Object.entries(result?.data).forEach(([key, value]) => {
      const vital = key
        .split('performance_score(measurements.score.')?.[1]
        ?.split(')')[0];
      if (vital) {
        data[vital as keyof WebVitalsScoreBreakdown] = value.data;
      }
    });
  }

  return {data, isLoading: result.isPending};
};
