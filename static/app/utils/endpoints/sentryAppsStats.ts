// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface SentryAppsStatsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<SentryAppsStatsResponse>;
type TData = SentryAppsStatsResponse;

/** @public */
export function sentryAppsStatsOptions() {
  return queryOptions({
    queryKey: getQueryKey('/sentry-apps-stats/'),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
