// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectReleaseDetailsResponse {
  // No response keys detected — fill in manually
}

interface ProjectReleaseDetailsQueryParams {
  health?: string;
  healthStatsPeriod?: string;
  summaryStatsPeriod?: string;
}

type TQueryData = ApiResponse<ProjectReleaseDetailsResponse>;
type TData = ProjectReleaseDetailsResponse;

/**
 * @public
 * Retrieve a Project's Release
 *         ````````````````````````````
 *
 *         Return details on an individual release.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           release belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to retrieve the
 *                                      release of.
 *         :pparam string version: the version identifier of the release.
 *         :auth: required
 */
export function projectReleaseDetailsOptions(
  organization: Organization,
  project: Project,
  version: string,
  query?: ProjectReleaseDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          version,
        },
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
