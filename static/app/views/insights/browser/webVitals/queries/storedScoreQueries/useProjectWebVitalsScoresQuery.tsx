import type {Tag} from 'sentry/types/group';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanIndexedField, type SubregionCode} from 'sentry/views/insights/types';

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
      search: [DEFAULT_QUERY_FILTER, search.formatString()].join(' ').trim(),
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
          : [`sum(measurements.score.weight.${weightWebVital})` as const]),
      ],
    },
    'api.performance.browser.web-vitals.project-scores'
  );

  const finalData: Array<
    (typeof result.data)[0] & {
      'avg(measurements.score.total)': number;
    }
  > = result.data.map(row => {
    // Map performance_score(measurements.score.total) to avg(measurements.score.total) so we don't have to handle both keys in the UI
    return {
      ...row,
      'avg(measurements.score.total)': row['performance_score(measurements.score.total)'],
    };
  });

  return {...result, data: finalData};
};
