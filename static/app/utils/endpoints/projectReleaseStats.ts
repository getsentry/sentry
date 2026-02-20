// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectReleaseStatsResponse {
  detail: unknown;
}

interface ProjectReleaseStatsQueryParams {
  end?: string;
  environment?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
  type?: string;
}

type TQueryData = ApiResponse<ProjectReleaseStatsResponse>;
type TData = ProjectReleaseStatsResponse;

/**
 * @public
 * Get a Project Release's Stats
 *         `````````````````````````````
 *
 *         Returns the stats of a given release under a project.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           release belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to list the
 *                                      release files of.
 *         :pparam string version: the version identifier of the release.
 *         :auth: required
 */
export function projectReleaseStatsOptions(
  organization: Organization,
  project: Project,
  version: string,
  query?: ProjectReleaseStatsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/stats/',
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
