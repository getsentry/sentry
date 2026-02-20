// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface AuthConfigResponse {
  nextUri: unknown;
}

type TQueryData = ApiResponse<AuthConfigResponse>;
type TData = AuthConfigResponse;

/**
 * @public
 * Get context required to show a login page. Registration is handled elsewhere.
 */
export function authConfigOptions() {
  return queryOptions({
    queryKey: getQueryKey('/auth/config/'),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
