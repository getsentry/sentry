// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationPullRequestSizeAnalysisDownloadResponse {
  detail: unknown;
}

type TQueryData = ApiResponse<OrganizationPullRequestSizeAnalysisDownloadResponse>;
type TData = OrganizationPullRequestSizeAnalysisDownloadResponse;

/**
 * @public
 * Download size analysis results for a preprod artifact
 *         ````````````````````````````````````````````````````
 *
 *         Download the size analysis results for a preprod artifact. This is separate from the
 *         ProjectPreprodArtifactSizeAnalysisDownloadEndpoint as PR page is not tied to a project.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           artifact belongs to.
 *         :pparam string artifact_id: the ID of the preprod artifact to download size analysis for.
 *         :auth: required
 */
export function organizationPullRequestSizeAnalysisDownloadOptions(
  organization: Organization,
  artifactId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/pull-requests/size-analysis/$artifactId/',
      {
        path: {organizationIdOrSlug: organization.slug, artifactId},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
