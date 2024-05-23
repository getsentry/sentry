import type {Tag} from 'sentry/types';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useAggregateFunction} from 'sentry/views/performance/browser/webVitals/utils/useAggregateFunction';

type Props = {
  dataset?: DiscoverDatasets;
  tag?: Tag;
  transaction?: string;
};

export const useProjectRawWebVitalsQuery = ({transaction, tag, dataset}: Props = {}) => {
  const aggregateFunction = useAggregateFunction();
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

  const projectEventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        `${aggregateFunction}(measurements.lcp)`,
        `${aggregateFunction}(measurements.fcp)`,
        `${aggregateFunction}(measurements.cls)`,
        `${aggregateFunction}(measurements.ttfb)`,
        `${aggregateFunction}(measurements.fid)`,
        `${aggregateFunction}(measurements.inp)`,
        `${aggregateFunction}(transaction.duration)`,
        'count_web_vitals(measurements.lcp, any)',
        'count_web_vitals(measurements.fcp, any)',
        'count_web_vitals(measurements.cls, any)',
        'count_web_vitals(measurements.fid, any)',
        'count_web_vitals(measurements.ttfb, any)',
        'count()',
      ],
      name: 'Web Vitals',
      query: [
        'transaction.op:[pageload,""]',
        'span.op:[ui.interaction.click,""]',
        search.formatString(),
      ]
        .join(' ')
        .trim(),
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
      refetchOnWindowFocus: false,
    },
    skipAbort: true,
    referrer: 'api.performance.browser.web-vitals.project',
  });
  return result;
};
