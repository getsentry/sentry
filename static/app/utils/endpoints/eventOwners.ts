// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface EventOwnersResponse {
  detail: unknown;
  owners: unknown;
  rule: unknown;
  rules: unknown;
}

type TQueryData = ApiResponse<EventOwnersResponse>;
type TData = EventOwnersResponse;

/**
 * @public
 * Retrieve suggested owners information for an event
 *         ``````````````````````````````````````````````````
 *
 *         :pparam string project_id_or_slug: the id or slug of the project the event
 *                                      belongs to.
 *         :pparam string event_id: the id of the event.
 *         :auth: required
 */
export function eventOwnersOptions(
  organization: Organization,
  project: Project,
  eventId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/owners/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          eventId,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
