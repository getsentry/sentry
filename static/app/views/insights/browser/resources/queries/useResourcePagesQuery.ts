import {
  DEFAULT_RESOURCE_FILTERS,
  getDomainFilter,
  getResourceTypeFilter,
} from 'sentry/views/insights/browser/common/queries/useResourcesQuery';
import {useResourceModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_DOMAIN, SPAN_OP} = SpanMetricsField;

/**
 * Gets a list of pages that have a resource.
 */
export const useResourcePagesQuery = (
  defaultResourceTypes?: string[],
  search?: string
) => {
  const resourceFilters = useResourceModuleFilters();
  const {[SPAN_DOMAIN]: spanDomain} = resourceFilters;

  const queryConditions = [
    ...DEFAULT_RESOURCE_FILTERS,
    ...getResourceTypeFilter(resourceFilters[SPAN_OP], defaultResourceTypes),
    ...getDomainFilter(spanDomain),
    ...(search && search.length > 0
      ? [`${SpanMetricsField.TRANSACTION}:*${[search]}*`]
      : []),
  ]; // TODO: We will need to consider other ops

  const result = useSpanMetrics(
    {
      fields: ['transaction', 'count()'],
      search: queryConditions.join(' '),
      limit: 100,
    },
    'api.performance.browser.resources.page-selector'
  );

  const pages = result?.data?.map(row => row.transaction).sort() || [];
  return {...result, data: pages};
};
