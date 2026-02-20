// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface NotificationActionsDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<NotificationActionsDetailsResponse>;
type TData = NotificationActionsDetailsResponse;

/**
 * @public
 * Returns a serialized Spike Protection Notification Action object.
 *
 *         Notification Actions notify a set of members when an action has been triggered through a notification service such as Slack or Sentry.
 *         For example, organization owners and managers can receive an email when a spike occurs.
 */
export function notificationActionsDetailsOptions(
  organization: Organization,
  actionId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/notifications/actions/$actionId/',
      {
        path: {organizationIdOrSlug: organization.slug, actionId},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
