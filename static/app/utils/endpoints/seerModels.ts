// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface SeerModelsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<SeerModelsResponse>;
type TData = SeerModelsResponse;

/**
 * @public
 * Get list of actively used LLM model names from Seer.
 *
 *         Returns the list of AI models that are currently used in production in Seer.
 *         This endpoint does not require authentication and can be used to discover which models Seer uses.
 *
 *         Requests to this endpoint should use the region-specific domain
 *         eg. `us.sentry.io` or `de.sentry.io`
 */
export function seerModelsOptions() {
  return queryOptions({
    queryKey: getQueryKey('/seer/models/'),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
