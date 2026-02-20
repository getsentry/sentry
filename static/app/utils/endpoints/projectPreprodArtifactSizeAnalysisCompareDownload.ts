// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectPreprodArtifactSizeAnalysisCompareDownloadResponse {
  detail: unknown;
}

type TQueryData = ApiResponse<ProjectPreprodArtifactSizeAnalysisCompareDownloadResponse>;
type TData = ProjectPreprodArtifactSizeAnalysisCompareDownloadResponse;

/**
 * @public
 * Download size analysis comparison results for specific size metrics
 *         ````````````````````````````````````````````````````
 *
 *         Download the size analysis comparison results for specific size metrics.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           artifact belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to retrieve the
 *                                      artifact from.
 *         :pparam string head_size_metric_id: the ID of the head size metric to download size analysis comparison for.
 *         :pparam string base_size_metric_id: the ID of the base size metric to download size analysis comparison for.
 *         :auth: required
 */
export function projectPreprodArtifactSizeAnalysisCompareDownloadOptions(
  organization: Organization,
  project: Project,
  headSizeMetricId: string,
  baseSizeMetricId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/preprodartifacts/size-analysis/compare/$headSizeMetricId/$baseSizeMetricId/download/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          headSizeMetricId,
          baseSizeMetricId,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
