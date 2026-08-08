import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  AttributeTypeValue,
  TraceItemAttributeListItem,
  TraceItemDatasetValue,
} from 'sentry/views/explore/attributeDescriptions/types';

export const ATTRIBUTE_DESCRIPTIONS_PER_PAGE = 100;

interface UseAttributeDescriptionsProps {
  dataset: TraceItemDatasetValue;
  attributeType?: AttributeTypeValue;
  cursor?: string;
  search?: string;
}

/**
 * Returns `apiOptions` for the paginated trace item attributes list, scoped to
 * the current page filters and requesting authored context (brief / details /
 * examples). Pass the result to `useQuery` with `selectJsonWithHeaders` to read
 * the `Link` pagination header.
 */
export function useAttributeDescriptionsQueryOptions({
  dataset,
  attributeType,
  search,
  cursor,
}: UseAttributeDescriptionsProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const query: Record<string, string | string[] | number[] | undefined> = {
    dataset,
    expand: 'context',
    per_page: String(ATTRIBUTE_DESCRIPTIONS_PER_PAGE),
    // The attributes endpoint matches names via a dedicated substring param.
    substringMatch: search || undefined,
    attributeType: attributeType || undefined,
    cursor: cursor || undefined,
    project: selection.projects.length ? selection.projects.map(String) : undefined,
    environment: selection.environments.length ? selection.environments : undefined,
  };

  Object.entries(normalizeDateTimeParams(selection.datetime)).forEach(([key, value]) => {
    if (defined(value)) {
      query[key] = value;
    }
  });

  return apiOptions.as<TraceItemAttributeListItem[]>()(
    '/organizations/$organizationIdOrSlug/trace-items/attributes/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query,
      staleTime: 0,
    }
  );
}
