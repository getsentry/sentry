// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface AuthMergeUserAccountsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<AuthMergeUserAccountsResponse>;
type TData = AuthMergeUserAccountsResponse;

/** @public */
export function authMergeUserAccountsOptions() {
  return queryOptions({
    queryKey: getQueryKey('/auth-v2/merge-accounts/'),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
