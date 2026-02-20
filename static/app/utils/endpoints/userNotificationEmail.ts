// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface UserNotificationEmailResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<UserNotificationEmailResponse>;
type TData = UserNotificationEmailResponse;

/**
 * @public
 * Fetches the user's email notification settings.
 *         Returns a dictionary where the keys are the IDs of the projects
 *         and the values are the email addresses to be used for notifications for that project.
 */
export function userNotificationEmailOptions(userId: string) {
  return queryOptions({
    queryKey: getQueryKey('/users/$userId/notifications/email/', {
      path: {userId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
