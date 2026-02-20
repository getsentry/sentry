// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface OrganizationDetectorIndexResponse {
  // No response keys detected — fill in manually
}

interface OrganizationDetectorIndexQueryParams {
  /** The ID of the monitor you'd like to query. */
  id?: string[];
  /** The IDs of projects to filter by. `-1` means all available projects. For example, the following are valid parameters: -  */
  project?: string[];
  /** An optional search query for filtering monitors. */
  query?: string | MutableSearch;
  /** The property to sort results by. If not specified, the results are sorted by id. Available fields are: - `name` - `id` - */
  sortBy?: string;
}

type TQueryData = ApiResponse<OrganizationDetectorIndexResponse>;
type TData = OrganizationDetectorIndexResponse;

/**
 * @public
 * ⚠️ This endpoint is currently in **beta** and may be subject to change. It is supported by [New Monitors and Alerts](/product/new-monitors-and-alerts/) and may not be viewable in the UI today.
 *
 *         List an Organization's Monitors
 */
export function organizationDetectorIndexOptions(
  organization: Organization,
  query?: OrganizationDetectorIndexQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/detectors/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
