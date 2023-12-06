import * as Sentry from '@sentry/react';

import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useResourceModuleFilters} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {
  DEFAULT_RESOURCE_FILTERS,
  getResourceTypeFilter,
} from 'sentry/views/performance/browser/resources/utils/useResourcesQuery';
import {SpanMetricsField} from 'sentry/views/starfish/types';

const {SPAN_DOMAIN, SPAN_OP, TRANSACTION} = SpanMetricsField;

/**
 * Gets a list of pages that have a resource.
 */
export const useResourceDomainsQuery = (defaultResourceTypes?: string[]) => {
  const location = useLocation();
  const pageFilters = usePageFilters();
  const {slug: orgSlug} = useOrganization();
  const resourceFilters = useResourceModuleFilters();

  const fields = [SPAN_DOMAIN, 'count()']; // count() is only here because an aggregation is required for the query to work

  const queryConditions = [
    ...DEFAULT_RESOURCE_FILTERS,
    `has:${SPAN_DOMAIN}`,
    ...getResourceTypeFilter(resourceFilters[SPAN_OP], defaultResourceTypes),
    ...(resourceFilters[TRANSACTION]
      ? [`transaction:${resourceFilters[TRANSACTION]}`]
      : []),
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
    result?.data?.data
      .map(row => {
        const domains = row[SPAN_DOMAIN] as any as string[];
        if (domains?.length > 1) {
          Sentry.captureException(new Error('More than one domain found in a resource'));
        }
        return domains[0].toString();
      })
      .filter(domain => domain !== '*')
      .sort() || [];

  return {...result, data};
};
