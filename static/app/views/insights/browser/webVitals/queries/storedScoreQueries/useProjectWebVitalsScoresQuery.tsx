import type {Tag} from 'sentry/types';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {BrowserType} from 'sentry/views/insights/browser/webVitals/components/browserTypeSelector';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {SpanIndexedField} from 'sentry/views/insights/types';

type Props = {
  browserType?: BrowserType;
  dataset?: DiscoverDatasets;
  enabled?: boolean;
  tag?: Tag;
  transaction?: string;
  weightWebVital?: WebVitals | 'total';
};

export const useProjectWebVitalsScoresQuery = ({
  transaction,
  tag,
  dataset,
  enabled = true,
  weightWebVital = 'total',
  browserType,
}: Props = {}) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const search = new MutableSearch([]);
  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  if (tag) {
    search.addFilterValue(tag.key, tag.name);
  }
  if (browserType !== undefined && browserType !== BrowserType.ALL) {
    search.addFilterValue(SpanIndexedField.BROWSER_NAME, browserType);
  }

  const projectEventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'performance_score(measurements.score.lcp)',
        'performance_score(measurements.score.fcp)',
        'performance_score(measurements.score.cls)',
        `performance_score(measurements.score.inp)`,
        'performance_score(measurements.score.ttfb)',
        'avg(measurements.score.total)',
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
    location,
    orgSlug: organization.slug,
    cursor: '',
    options: {
      enabled,
      refetchOnWindowFocus: false,
    },
    skipAbort: true,
    referrer: 'api.performance.browser.web-vitals.project-scores',
  });

  return result;
};
