import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useResourceModuleFilters} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';

/**
 * Gets a list of pages that have a resource.
 */
export const useResourceDomainsQuery = () => {
  const location = useLocation();
  const pageFilters = usePageFilters();
  const {slug: orgSlug} = useOrganization();
  const {transaction} = useResourceModuleFilters();

  const fields = ['avg(span.self_time)', 'span.domain']; // TODO: this query fails without avg(span.self_time)

  const queryConditions = [
    `span.op:resource.*`,
    'has:span.domain',
    ...(transaction ? [`transaction:${transaction}`] : []),
  ];

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields, // for some reason we need a function, otherwise the query fails
      name: 'Resource module - page selector',
      version: 2,
      query: queryConditions.join(' '),
      dataset: DiscoverDatasets.SPANS_METRICS,
    },
    pageFilters.selection
  );

  const result = useDiscoverQuery({
    eventView,
    referrer: 'api.performance.browser.resources.page-selector',
    location,
    orgSlug,
    limit: 100,
  });
  const data: string[] =
    result?.data?.data.map(row => row['span.domain'][0].toString()).sort() || [];

  return {...result, data};
};
