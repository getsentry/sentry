// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectIssuesResolvedInReleaseResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<ProjectIssuesResolvedInReleaseResponse>;
type TData = ProjectIssuesResolvedInReleaseResponse;

/**
 * @public
 * List issues to be resolved in a particular release
 *         ``````````````````````````````````````````````````
 *
 *         Retrieve a list of issues to be resolved in a given release.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           release belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project associated with the release.
 *         :pparam string version: the version identifier of the release.
 *         :auth: required
 */
export function projectIssuesResolvedInReleaseOptions(
  organization: Organization,
  project: Project,
  version: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/resolved/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          version,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
