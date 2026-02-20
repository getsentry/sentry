// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectEventsResponse {
  // No response keys detected — fill in manually
}

interface ProjectEventsQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
  /** Specify true to include the full event body, including the stacktrace, in the event payload. */
  full?: boolean;
  /** Return events in pseudo-random order. This is deterministic so an identical query will always return the same events in  */
  sample?: boolean;
}

type TQueryData = ApiResponse<ProjectEventsResponse>;
type TData = ProjectEventsResponse;

/**
 * @public
 * Return a list of events bound to a project.
 */
export function projectEventsOptions(
  organization: Organization,
  project: Project,
  query?: ProjectEventsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/projects/$organizationIdOrSlug/$projectIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
