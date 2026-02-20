// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectIndexResponse {
  // No response keys detected — fill in manually
}

interface ProjectIndexQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
}

type TQueryData = ApiResponse<ProjectIndexResponse>;
type TData = ProjectIndexResponse;

/**
 * @public
 * List your Projects
 *         ``````````````````
 *
 *         Return a list of projects available to the authenticated
 *         session in a region.
 *
 *         :auth: required
 */
export function projectIndexOptions(query?: ProjectIndexQueryParams) {
  return queryOptions({
    queryKey: getQueryKey('/projects/', {query}),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
