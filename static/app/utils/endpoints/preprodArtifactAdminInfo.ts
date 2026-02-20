// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface PreprodArtifactAdminInfoResponse {
  artifact_info: unknown;
  error: unknown;
  success: unknown;
}

type TQueryData = ApiResponse<PreprodArtifactAdminInfoResponse>;
type TData = PreprodArtifactAdminInfoResponse;

/**
 * @public
 * Get comprehensive info for a preprod artifact
 *         ````````````````````````````````````````````
 *
 *         Admin endpoint to retrieve all associated data for a specific preprod artifact.
 *         This endpoint requires superuser privileges.
 *
 *         Returns comprehensive information including:
 *         - Basic artifact metadata
 *         - Build and app information
 *         - VCS/commit information
 *         - File information
 *         - Size metrics
 *         - Error details (if any)
 *
 *         :auth: required (superuser)
 *         #
 */
export function preprodArtifactAdminInfoOptions(headArtifactId: string) {
  return queryOptions({
    queryKey: getQueryKey('/internal/preprod-artifact/$headArtifactId/info/', {
      path: {headArtifactId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
