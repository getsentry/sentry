// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface AdminRelayProjectConfigsResponse {
  configs: unknown;
  error: unknown;
}

interface AdminRelayProjectConfigsQueryParams {
  projectId?: string;
  projectKey?: string;
}

type TQueryData = ApiResponse<AdminRelayProjectConfigsResponse>;
type TData = AdminRelayProjectConfigsResponse;

/**
 * @public
 * The GET endpoint retrieves the project configs for a specific project_id
 *         or a set of project keys.
 *         If a projectId is provided, the configs for all project keys are returned.
 *         If a projectKey is provided, the config for that specific project key is returned.
 *         Both a projectId and a projectKey may be provided in the same request.
 *
 *         If the project config is currently in cache, will return the cache entry.
 *         If the project config is not in cache, the project config for that key will be null.
 */
export function adminRelayProjectConfigsOptions(
  query?: AdminRelayProjectConfigsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/internal/project-config/', {query}),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
