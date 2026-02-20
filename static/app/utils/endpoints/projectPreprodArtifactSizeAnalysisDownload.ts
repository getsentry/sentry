// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectPreprodArtifactSizeAnalysisDownloadResponse {
  detail: unknown;
}

type TQueryData = ApiResponse<ProjectPreprodArtifactSizeAnalysisDownloadResponse>;
type TData = ProjectPreprodArtifactSizeAnalysisDownloadResponse;

/**
 * @public
 * Download size analysis results for a preprod artifact
 *         ````````````````````````````````````````````````````
 *
 *         Download the size analysis results for a preprod artifact.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           artifact belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to retrieve the
 *                                      artifact from.
 *         :pparam string head_artifact_id: the ID of the preprod artifact to download size analysis for.
 *         :auth: required
 */
export function projectPreprodArtifactSizeAnalysisDownloadOptions(
  organization: Organization,
  project: Project,
  headArtifactId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/files/preprodartifacts/$headArtifactId/size-analysis/',
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
