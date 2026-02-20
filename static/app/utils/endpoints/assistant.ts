// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface AssistantResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<AssistantResponse>;
type TData = AssistantResponse;

/**
 * @public
 * Return all the guides with a 'seen' attribute if it has been 'viewed' or 'dismissed'.
 */
export function assistantOptions() {
  return queryOptions({
    queryKey: getQueryKey('/assistant/'),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
