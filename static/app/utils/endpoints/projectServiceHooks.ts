// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectServiceHooksResponse {
  // No response keys detected — fill in manually
}

interface ProjectServiceHooksQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
}

type TQueryData = ApiResponse<ProjectServiceHooksResponse>;
type TData = ProjectServiceHooksResponse;

/**
 * @public
 * List a Project's Service Hooks
 *         ``````````````````````````````
 *
 *         Return a list of service hooks bound to a project.
 *
 *         This endpoint requires the 'servicehooks' feature to
 *         be enabled for your project.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           client keys belong to.
 *         :pparam string project_id_or_slug: the id or slug of the project the client keys
 *                                      belong to.
 *         :auth: required
 */
export function projectServiceHooksOptions(
  organization: Organization,
  project: Project,
  query?: ProjectServiceHooksQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/projects/$organizationIdOrSlug/$projectIdOrSlug/hooks/', {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
