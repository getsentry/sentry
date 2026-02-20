// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectPreprodArtifactDownloadResponse {
  detail: unknown;
}

type TQueryData = ApiResponse<ProjectPreprodArtifactDownloadResponse>;
type TData = ProjectPreprodArtifactDownloadResponse;

/**
 * @public
 * Download a preprod artifact file
 *         ```````````````````````````````
 *
 *         Download the actual file contents of a preprod artifact.
 *         Supports HTTP Range requests for resumable downloads.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           artifact belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to retrieve the
 *                                      artifact from.
 *         :pparam string head_artifact_id: the ID of the preprod artifact to download.
 *         :auth: required
 */
export function projectPreprodArtifactDownloadOptions(
  organization: Organization,
  project: Project,
  headArtifactId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/internal/$organizationIdOrSlug/$projectIdOrSlug/files/preprodartifacts/$headArtifactId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          headArtifactId,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
