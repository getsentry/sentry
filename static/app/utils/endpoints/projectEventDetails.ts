// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectEventDetailsResponse {
  detail: unknown;
}

interface ProjectEventDetailsQueryParams {
  end?: string;
  environment?: string[];
  group_id?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
}

type TQueryData = ApiResponse<ProjectEventDetailsResponse>;
type TData = ProjectEventDetailsResponse;

/**
 * @public
 * Retrieve an Event for a Project
 *         ```````````````````````````````
 *
 *         Return details on an individual event.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           event belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project the event
 *                                      belongs to.
 *         :pparam string event_id: the id of the event to retrieve.
 *                                  It is the hexadecimal id as
 *                                  reported by the raven client)
 *         :auth: required
 */
export function projectEventDetailsOptions(
  organization: Organization,
  project: Project,
  eventId: string,
  query?: ProjectEventDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          eventId,
        },
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
