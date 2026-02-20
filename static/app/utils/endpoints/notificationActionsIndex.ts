// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface NotificationActionsIndexResponse {
  // No response keys detected — fill in manually
}

interface NotificationActionsIndexQueryParams {
  /** The IDs of projects to filter by. `-1` means all available projects. For example, the following are valid parameters: -  */
  project?: number[];
  /** The project slugs to filter by. Use `$all` to include all available projects. For example, the following are valid param */
  project_id_or_slug?: string[];
  /** Type of the trigger that causes the notification. The only supported value right now is: `spike-protection` */
  triggerType?: string;
}

type TQueryData = ApiResponse<NotificationActionsIndexResponse>;
type TData = NotificationActionsIndexResponse;

/**
 * @public
 * Returns all Spike Protection Notification Actions for an organization.
 *
 *         Notification Actions notify a set of members when an action has been triggered through a notification service such as Slack or Sentry.
 *         For example, organization owners and managers can receive an email when a spike occurs.
 *
 *         You can use either the `project` or `projectSlug` query parameter to filter for certain projects. Note that if both are present, `projectSlug` takes priority.
 */
export function notificationActionsIndexOptions(
  organization: Organization,
  query?: NotificationActionsIndexQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/notifications/actions/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
