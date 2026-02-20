// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface UserNotificationSettingsOptionsResponse {
  // No response keys detected — fill in manually
}

interface UserNotificationSettingsOptionsQueryParams {
  type?: string;
}

type TQueryData = ApiResponse<UserNotificationSettingsOptionsResponse>;
type TData = UserNotificationSettingsOptionsResponse;

/**
 * @public
 * Retrieve the notification preferences for a user.
 *         Returns a list of NotificationSettingOption rows.
 */
export function userNotificationSettingsOptionsOptions(
  userId: string,
  query?: UserNotificationSettingsOptionsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/users/$userId/notification-options/', {
      path: {userId},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
