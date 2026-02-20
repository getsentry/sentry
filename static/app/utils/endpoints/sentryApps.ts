// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface SentryAppsResponse {
  // No response keys detected — fill in manually
}

interface SentryAppsQueryParams {
  status?: string;
}

type TQueryData = ApiResponse<SentryAppsResponse>;
type TData = SentryAppsResponse;

/** @public */
export function sentryAppsOptions(query?: SentryAppsQueryParams) {
  return queryOptions({
    queryKey: getQueryKey('/sentry-apps/', {query}),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
