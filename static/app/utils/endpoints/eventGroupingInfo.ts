// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface EventGroupingInfoResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<EventGroupingInfoResponse>;
type TData = EventGroupingInfoResponse;

/**
 * @public
 * Returns the grouping information for an event
 *         `````````````````````````````````````````````
 *
 *         This endpoint returns a JSON dump of the metadata that went into the
 *         grouping algorithm.
 */
export function eventGroupingInfoOptions(
  organization: Organization,
  project: Project,
  eventId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/grouping-info/',
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
