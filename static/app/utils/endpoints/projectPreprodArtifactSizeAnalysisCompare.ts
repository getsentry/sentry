// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectPreprodArtifactSizeAnalysisCompareResponse {
  detail: unknown;
}

type TQueryData = ApiResponse<ProjectPreprodArtifactSizeAnalysisCompareResponse>;
type TData = ProjectPreprodArtifactSizeAnalysisCompareResponse;

/**
 * @public
 * Get size analysis comparison results for a preprod artifact
 *         ````````````````````````````````````````````````````
 *
 *         Get size analysis comparison results for a preprod artifact.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           artifact belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to retrieve the
 *                                      artifact from.
 *         :pparam string head_artifact_id: the ID of the head preprod artifact to get size analysis comparison for.
 *         :pparam string base_artifact_id: the ID of the base preprod artifact to get size analysis comparison for.
 *         :auth: required
 */
export function projectPreprodArtifactSizeAnalysisCompareOptions(
  organization: Organization,
  project: Project,
  headArtifactId: string,
  baseArtifactId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/preprodartifacts/size-analysis/compare/$headArtifactId/$baseArtifactId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          headArtifactId,
          baseArtifactId,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
