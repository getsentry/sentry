// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface OrganizationIndexResponse {
  // No response keys detected — fill in manually
}

interface OrganizationIndexQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
  /** Specify `true` to restrict results to organizations in which you are an owner. */
  owner?: boolean;
  /** Filters results by using [query syntax](/product/sentry-basics/search/). Valid query fields include: - `id`: The organiz */
  query?: string | MutableSearch;
  /** The field to sort results by, in descending order. If not specified the results are sorted by the date they were created */
  sortBy?: string;
}

type TQueryData = ApiResponse<OrganizationIndexResponse>;
type TData = OrganizationIndexResponse;

/**
 * @public
 * Return a list of organizations available to the authenticated session in a region.
 *         This is particularly useful for requests with a user bound context. For API key-based requests this will only return the organization that belongs to the key.
 */
export function organizationIndexOptions(query?: OrganizationIndexQueryParams) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/', {serializedQuery}),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
