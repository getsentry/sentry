// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface UserNotificationSettingsProvidersResponse {
  // No response keys detected — fill in manually
}

interface UserNotificationSettingsProvidersQueryParams {
  type?: string;
}

type TQueryData = ApiResponse<UserNotificationSettingsProvidersResponse>;
type TData = UserNotificationSettingsProvidersResponse;

/**
 * @public
 * Retrieve the notification provider preferences for a user.
 *         Returns a list of NotificationSettingProvider rows.
 */
export function userNotificationSettingsProvidersOptions(
  userId: string,
  query?: UserNotificationSettingsProvidersQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/users/$userId/notification-providers/', {
      path: {userId},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
