// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface RelocationArtifactDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<RelocationArtifactDetailsResponse>;
type TData = RelocationArtifactDetailsResponse;

/**
 * @public
 * Get a single relocation artifact.
 *         ``````````````````````````````````````````````````
 *
 *         :pparam string relocation_uuid: a UUID identifying the relocation.
 *         :pparam string artifact_kind: one of `conf` | `in` | `out` | `findings`.
 *         :pparam string file_name: The name of the file itself.
 *
 *         :auth: required
 */
export function relocationArtifactDetailsOptions(
  relocationUuid: string,
  artifactKind: string,
  fileName: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/relocations/$relocationUuid/artifacts/$artifactKind/$fileName',
      {
        path: {relocationUuid, artifactKind, fileName},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
