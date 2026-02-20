// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface RelocationArtifactIndexResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<RelocationArtifactIndexResponse>;
type TData = RelocationArtifactIndexResponse;

/**
 * @public
 * Lists all relocation bucket files associated with a relocation
 *         ``````````````````````````````````````````````````
 *
 *         :pparam string relocation_uuid: a UUID identifying the relocation.
 *
 *         :auth: required
 */
export function relocationArtifactIndexOptions(relocationUuid: string) {
  return queryOptions({
    queryKey: getQueryKey('/relocations/$relocationUuid/artifacts/', {
      path: {relocationUuid},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
