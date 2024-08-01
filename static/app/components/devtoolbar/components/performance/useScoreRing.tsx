import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import type {Tag} from 'sentry/types/group';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {SpanIndexedField} from 'sentry/views/insights/types';

type Props = {
  browserTypes?: BrowserType[];
  dataset?: DiscoverDatasets;
  enabled?: boolean;
  tag?: Tag;
  transaction?: string;
  weightWebVital?: WebVitals | 'total';
};

// largely copied from useProjectWebVitalsScoresQuery.tsx
export const useScoreRing = ({
  transaction,
  tag,
  dataset,
  enabled = true,
  weightWebVital = 'total',
  browserTypes,
}: Props = {}) => {
  const pageFilters = usePageFilters();
  const {organizationSlug} = useConfiguration();

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

  const projectEventView = EventView.fromNewQueryWithPageFilters(
    {
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
        ...(weightWebVital !== 'total'
          ? [`sum(measurements.score.weight.${weightWebVital})`]
          : []),
      ],
      name: 'Web Vitals',
      query: [DEFAULT_QUERY_FILTER, search.formatString()].join(' ').trim(),
      version: 2,
      dataset: dataset ?? DiscoverDatasets.METRICS,
    },
    pageFilters.selection
  );

  const result = useDiscoverQuery({
    eventView: projectEventView,
    limit: 50,
    // hardcode empty location since `useLocation()` breaks things
    location: {
      pathname: '',
      search: '',
      query: {},
      hash: '',
      state: '',
      key: '',
      action: 'PUSH',
    },
    orgSlug: organizationSlug,
    cursor: '',
    options: {
      enabled,
      refetchOnWindowFocus: false,
    },
    skipAbort: true,
    referrer: 'api.performance.browser.web-vitals.project-scores',
  });

  // Map performance_score(measurements.score.total) to avg(measurements.score.total) so we don't have to handle both keys in the UI
  if (
    result.data?.data?.[0]?.['performance_score(measurements.score.total)'] !== undefined
  ) {
    result.data.data[0]['avg(measurements.score.total)'] =
      result.data.data[0]['performance_score(measurements.score.total)'];
  }

  return result;
};
