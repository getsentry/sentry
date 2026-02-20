// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface ExploreSavedQueriesResponse {
  // No response keys detected — fill in manually
}

interface ExploreSavedQueriesQueryParams {
  exclude?: string;
  /** Limit the number of rows to return in the result. Default and maximum allowed is 100. */
  per_page?: string;
  /** The name of the Explore query you'd like to filter by. */
  query?: string | MutableSearch;
  /** The property to sort results by. If not specified, the results are sorted by query name. Available fields are: - `name`  */
  sortBy?: string;
  starred?: string;
}

type TQueryData = ApiResponse<ExploreSavedQueriesResponse>;
type TData = ExploreSavedQueriesResponse;

/**
 * @public
 * Retrieve a list of saved queries that are associated with the given organization.
 */
export function exploreSavedQueriesOptions(
  organization: Organization,
  query?: ExploreSavedQueriesQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/explore/saved/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
