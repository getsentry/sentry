// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface UserAvatarResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<UserAvatarResponse>;
type TData = UserAvatarResponse;

/** @public */
export function userAvatarOptions(userId: string) {
  return queryOptions({
    queryKey: getQueryKey('/users/$userId/avatar/', {
      path: {userId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
