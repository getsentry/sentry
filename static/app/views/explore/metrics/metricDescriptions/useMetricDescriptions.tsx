import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TraceMetricListItem} from 'sentry/views/explore/metrics/metricDescriptions/types';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricTypeValue,
} from 'sentry/views/explore/metrics/types';

export const METRIC_DESCRIPTIONS_PER_PAGE = 100;

interface UseMetricDescriptionsProps {
  cursor?: string;
  hasContext?: boolean;
  search?: string;
  type?: TraceMetricTypeValue;
}

/**
 * Builds the search string forwarded to the trace metrics list endpoint. The
 * name is matched as a "contains" filter and the type (when set) as an exact
 * match, mirroring how the explore metric picker builds its queries.
 */
function buildQueryString({
  search,
  type,
}: Pick<UseMetricDescriptionsProps, 'search' | 'type'>) {
  const mutableSearch = new MutableSearch('');
  if (search) {
    mutableSearch.addContainsFilterValue(TraceMetricKnownFieldKey.METRIC_NAME, search);
  }
  if (type) {
    mutableSearch.addFilterValue(TraceMetricKnownFieldKey.METRIC_TYPE, type);
  }
  const formatted = mutableSearch.formatString();
  return formatted.length > 0 ? formatted : undefined;
}

/**
 * Returns `apiOptions` for the paginated trace metrics list, scoped to the
 * current page filters and requesting authored context (brief / details).
 * Pass the result to `useQuery` with `selectJsonWithHeaders` to read the
 * `Link` pagination header.
 */
export function useMetricDescriptionsQueryOptions({
  search,
  type,
  hasContext,
  cursor,
}: UseMetricDescriptionsProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const query: Record<string, string | string[] | number[] | undefined> = {
    expand: 'context',
    per_page: String(METRIC_DESCRIPTIONS_PER_PAGE),
    // Sort by metric name (endpoint's `sort` uses response field names, not
    // the underlying attribute alias).
    sort: 'name',
    query: buildQueryString({search, type}),
    // Restricts results to metrics that already have authored context.
    contextOnly: hasContext ? '1' : undefined,
    cursor: cursor || undefined,
    project: selection.projects.length ? selection.projects.map(String) : undefined,
    environment: selection.environments.length ? selection.environments : undefined,
  };

  Object.entries(normalizeDateTimeParams(selection.datetime)).forEach(([key, value]) => {
    if (defined(value)) {
      query[key] = value;
    }
  });

  return apiOptions.as<TraceMetricListItem[]>()(
    '/organizations/$organizationIdOrSlug/trace-items/metrics/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query,
      staleTime: 0,
    }
  );
}
