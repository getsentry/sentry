// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectArtifactBundleFileDetailsResponse {
  error: unknown;
}

type TQueryData = ApiResponse<ProjectArtifactBundleFileDetailsResponse>;
type TData = ProjectArtifactBundleFileDetailsResponse;

/**
 * @public
 * Retrieve the file of an artifact bundle
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
 *         :pparam string bundle_id: the bundle_id of the artifact bundle that
 *                                     should contain the file identified by file_id.
 *         :pparam string file_id: the ID of the file to retrieve.
 *         :auth: required
 */
export function projectArtifactBundleFileDetailsOptions(
  organization: Organization,
  project: Project,
  bundleId: string,
  fileId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/artifact-bundles/$bundleId/files/$fileId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          bundleId,
          fileId,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
