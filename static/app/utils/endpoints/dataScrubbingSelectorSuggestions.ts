// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface DataScrubbingSelectorSuggestionsResponse {
  suggestions: unknown;
}

interface DataScrubbingSelectorSuggestionsQueryParams {
  eventId?: string;
  project?: string;
}

type TQueryData = ApiResponse<DataScrubbingSelectorSuggestionsResponse>;
type TData = DataScrubbingSelectorSuggestionsResponse;

/**
 * @public
 * Generate a list of data scrubbing selectors from existing event data.
 *
 *         This list is used to auto-complete settings in "Data Scrubbing" /
 *         "Security and Privacy" settings.
 */
export function dataScrubbingSelectorSuggestionsOptions(
  organization: Organization,
  query?: DataScrubbingSelectorSuggestionsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/data-scrubbing-selector-suggestions/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
