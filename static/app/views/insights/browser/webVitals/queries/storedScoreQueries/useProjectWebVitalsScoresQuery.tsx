import type {Tag} from 'sentry/types/group';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useDefaultWebVitalsQuery} from 'sentry/views/insights/browser/webVitals/utils/useDefaultQuery';
import {useMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {
  type MetricsProperty,
  SpanIndexedField,
  type SubregionCode,
} from 'sentry/views/insights/types';

export type WebVitalsRow = {
  'avg(measurements.score.cls)': number;
  'avg(measurements.score.fcp)': number;
  'avg(measurements.score.inp)': number;
  'avg(measurements.score.lcp)': number;
  'avg(measurements.score.total)': number;
  'avg(measurements.score.ttfb)': number;
  'count()': number;
  'count_scores(measurements.score.cls)': number;
  'count_scores(measurements.score.fcp)': number;
  'count_scores(measurements.score.inp)': number;
  'count_scores(measurements.score.lcp)': number;
  'count_scores(measurements.score.total)': number;
  'count_scores(measurements.score.ttfb)': number;
  'performance_score(measurements.score.cls)': number;
  'performance_score(measurements.score.fcp)': number;
  'performance_score(measurements.score.inp)': number;
  'performance_score(measurements.score.lcp)': number;
  'performance_score(measurements.score.total)': number;
  'performance_score(measurements.score.ttfb)': number;
  'sum(measurements.score.weight.cls)': number | undefined;
  'sum(measurements.score.weight.fcp)': number | undefined;
  'sum(measurements.score.weight.inp)': number | undefined;
  'sum(measurements.score.weight.lcp)': number | undefined;
  'sum(measurements.score.weight.ttfb)': number | undefined;
};

type Props = {
  browserTypes?: BrowserType[];
  dataset?: DiscoverDatasets;
  subregions?: SubregionCode[];
  tag?: Tag;
  transaction?: string;
  weightWebVital?: WebVitals | 'total';
};

export const useProjectWebVitalsScoresQuery = ({
  transaction,
  tag,
  weightWebVital = 'total',
  browserTypes,
  subregions,
}: Props = {}) => {
  const defaultQuery = useDefaultWebVitalsQuery();

  const search = new MutableSearch([]);
  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  if (tag) {
    search.addFilterValue(tag.key, tag.name);
  }
  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanIndexedField.BROWSER_NAME, browserTypes);
  }
  if (subregions) {
    search.addDisjunctionFilterValues(SpanIndexedField.USER_GEO_SUBREGION, subregions);
  }

  const result = useMetrics(
    {
      cursor: '',
      limit: 50,
      search: [defaultQuery, search.formatString()].join(' ').trim(),
      fields: [
        'performance_score(measurements.score.lcp)',
        'performance_score(measurements.score.fcp)',
        'performance_score(measurements.score.cls)',
        `performance_score(measurements.score.inp)`,
        'performance_score(measurements.score.ttfb)',
        'performance_score(measurements.score.total)',
        'avg(measurements.score.weight.lcp)',
        'avg(measurements.score.weight.fcp)',
        'avg(measurements.score.weight.cls)',
        `avg(measurements.score.weight.inp)`,
        'avg(measurements.score.weight.ttfb)',
        'count()',
        'count_scores(measurements.score.total)',
        'count_scores(measurements.score.lcp)',
        'count_scores(measurements.score.fcp)',
        'count_scores(measurements.score.cls)',
        'count_scores(measurements.score.ttfb)',
        `count_scores(measurements.score.inp)`,
        ...(weightWebVital === 'total'
          ? []
          : [`sum(measurements.score.weight.${weightWebVital})` as MetricsProperty]),
      ],
    },
    'api.performance.browser.web-vitals.project-scores'
  );

  const data = result.data;

  // Map performance_score(measurements.score.total) to avg(measurements.score.total) so we don't have to handle both keys in the UI
  if (data?.[0]?.['performance_score(measurements.score.total)'] !== undefined) {
    data[0]['avg(measurements.score.total)'] =
      data[0]['performance_score(measurements.score.total)'];
  }

  return {...result, data: data as WebVitalsRow[]};
};
