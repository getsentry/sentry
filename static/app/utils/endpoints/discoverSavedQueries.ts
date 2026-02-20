// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface DiscoverSavedQueriesResponse {
  // No response keys detected — fill in manually
}

interface DiscoverSavedQueriesQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
  /** Limit the number of rows to return in the result. Default and maximum allowed is 100. */
  per_page?: number;
  /** The name of the Discover query you'd like to filter by. */
  query?: string | MutableSearch;
  /** The property to sort results by. If not specified, the results are sorted by query name. Available fields are: - `name`  */
  sortBy?: string;
}

type TQueryData = ApiResponse<DiscoverSavedQueriesResponse>;
type TData = DiscoverSavedQueriesResponse;

/**
 * @public
 * Retrieve a list of saved queries that are associated with the given organization.
 */
export function discoverSavedQueriesOptions(
  organization: Organization,
  query?: DiscoverSavedQueriesQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/discover/saved/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
