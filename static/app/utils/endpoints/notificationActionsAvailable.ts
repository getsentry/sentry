// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface NotificationActionsAvailableResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<NotificationActionsAvailableResponse>;
type TData = NotificationActionsAvailableResponse;

/**
 * @public
 * Responds with a payload serialized directly from running the 'serialize_available' methods
 *         on the ActionRegistration objects within the NotificationAction registry.
 */
export function notificationActionsAvailableOptions(organization: Organization) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/notifications/available-actions/',
      {
        path: {organizationIdOrSlug: organization.slug},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
