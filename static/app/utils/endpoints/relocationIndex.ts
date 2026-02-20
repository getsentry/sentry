// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: verify these types against the Python endpoint source
interface RelocationIndexResponse {
  detail: unknown;
}

interface RelocationIndexQueryParams {
  query?: string | MutableSearch;
  status?: string;
}

type TQueryData = ApiResponse<RelocationIndexResponse>;
type TData = RelocationIndexResponse;

/**
 * @public
 * A list of relocations, ordered by creation date.
 *         ``````````````````````````````````````````````````
 *
 *         :qparam string query: string to match in importing org slugs, username, or relocation UUID.
 *         :qparam string status: filter by status.
 *
 *         :auth: required
 */
export function relocationIndexOptions(query?: RelocationIndexQueryParams) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/relocations/', {serializedQuery}),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
