// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectReleaseFileDetailsResponse {
  // No response keys detected — fill in manually
}

interface ProjectReleaseFileDetailsQueryParams {
  /** If this is set to true, then the response payload will be the raw file contents. Otherwise, the response will be the fil */
  download?: boolean;
}

type TQueryData = ApiResponse<ProjectReleaseFileDetailsResponse>;
type TData = ProjectReleaseFileDetailsResponse;

/**
 * @public
 * Retrieve a Project Release's File
 *         `````````````````````````````````
 *
 *         Return details on an individual file within a release.  This does
 *         not actually return the contents of the file, just the associated
 *         metadata.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           release belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to retrieve the
 *                                      file of.
 *         :pparam string version: the version identifier of the release.
 *         :pparam string file_id: the ID of the file to retrieve.
 *         :auth: required
 */
export function projectReleaseFileDetailsOptions(
  organization: Organization,
  project: Project,
  version: string,
  fileId: string,
  query?: ProjectReleaseFileDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/files/$fileId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          version,
          fileId,
        },
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
