// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface EventFileCommittersResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<EventFileCommittersResponse>;
type TData = EventFileCommittersResponse;

/**
 * @public
 * Retrieve Suspect Commit information for an event
 *         ```````````````````````````````````````````
 *
 *         Return suspect commits on an individual event.
 *
 *         :pparam string project_id_or_slug: the id or slug of the project the event
 *                                      belongs to.
 *         :pparam string event_id: the hexadecimal ID of the event to
 *                                  retrieve (as reported by the raven client).
 *         :auth: required
 */
export function eventFileCommittersOptions(
  organization: Organization,
  project: Project,
  eventId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/committers/',
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
