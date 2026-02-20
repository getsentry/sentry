// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface RelayHealthCheckResponse {
  is_healthy: boolean;
}

type TQueryData = ApiResponse<RelayHealthCheckResponse>;
type TData = RelayHealthCheckResponse;

/** @public */
export function relayHealthCheckOptions() {
  return queryOptions({
    queryKey: getQueryKey('/relays/live/'),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
