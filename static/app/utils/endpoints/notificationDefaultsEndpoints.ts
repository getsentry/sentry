// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface NotificationDefaultsEndpointsResponse {
  providerDefaults: unknown;
  typeDefaults: unknown;
}

type TQueryData = ApiResponse<NotificationDefaultsEndpointsResponse>;
type TData = NotificationDefaultsEndpointsResponse;

/**
 * @public
 * Return the default config for notification settings.
 *         This becomes the fallback in the UI.
 */
export function notificationDefaultsEndpointsOptions() {
  return queryOptions({
    queryKey: getQueryKey('/notification-defaults/'),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
