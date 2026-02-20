// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface EventReprocessableResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<EventReprocessableResponse>;
type TData = EventReprocessableResponse;

/**
 * @public
 * Retrieve information about whether an event can be reprocessed.
 *         ```````````````````````````````````````````````````````````````
 *
 *         Returns `{"reprocessable": true}` if the event can be reprocessed, or
 *         `{"reprocessable": false, "reason": "<code>"}` if it can't.
 *
 *         Returns 404 if the reprocessing feature is disabled.
 *
 *         Only entire issues can be reprocessed using
 *         `GroupReprocessingEndpoint`, but we can tell you whether we will even
 *         attempt to reprocess a particular event within that issue being
 *         reprocessed based on what we know ahead of time.  reprocessable=true
 *         means that the event may change in some way, reprocessable=false means
 *         that there is no way it will change/improve.
 *
 *         Note this endpoint inherently suffers from time-of-check-time-of-use
 *         problem (time of check=calling this endpoint, time of use=triggering
 *         reprocessing) and the fact that event data + attachments is only
 *         eventually consistent.
 *
 *         `<code>` can be:
 *
 *         * `unprocessed_event.not_found`: Can have many reasons. The event
 *           is too old to be reprocessed (very unlikely!) or was not a native
 *           event.
 *         * `event.not_found`: The event does not exist.
 *         * `attachment.not_found`: A required attachment, such as the original
 *           minidump, is missing.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           issues belong to.
 *         :pparam string project_id_or_slug: the id or slug of the project the event
 *                                      belongs to.
 *         :pparam string event_id: the id of the event.
 *         :auth: required
 */
export function eventReprocessableOptions(
  organization: Organization,
  project: Project,
  eventId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/reprocessable/',
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
