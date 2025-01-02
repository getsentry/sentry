import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  DEFAULT_RESOURCE_FILTERS,
  getDomainFilter,
  getResourceTypeFilter,
} from 'sentry/views/insights/browser/common/queries/useResourcesQuery';
import {useResourceModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_DOMAIN, SPAN_OP} = SpanMetricsField;

/**
 * Gets a list of pages that have a resource.
 */
export const useResourcePagesQuery = (
  defaultResourceTypes?: string[],
  search?: string
) => {
  const location = useLocation();
  const pageFilters = usePageFilters();
  const {slug: orgSlug} = useOrganization();
  const resourceFilters = useResourceModuleFilters();
  const {[SPAN_DOMAIN]: spanDomain} = resourceFilters;

  const fields = ['transaction', 'count()']; // count() is only here because an aggregation is required for the query to work

  const queryConditions = [
    ...DEFAULT_RESOURCE_FILTERS,
    ...getResourceTypeFilter(resourceFilters[SPAN_OP], defaultResourceTypes),
    ...getDomainFilter(spanDomain),
    ...(search && search.length > 0
      ? [`${SpanMetricsField.TRANSACTION}:*${[search]}*`]
      : []),
  ]; // TODO: We will need to consider other ops

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

  const pages = result?.data?.data.map(row => row.transaction!.toString()).sort() || [];
  return {...result, data: pages};
};
