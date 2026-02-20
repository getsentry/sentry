// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface SentryAppFeaturesResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<SentryAppFeaturesResponse>;
type TData = SentryAppFeaturesResponse;

/** @public */
export function sentryAppFeaturesOptions(sentryAppIdOrSlug: string) {
  return queryOptions({
    queryKey: getQueryKey('/sentry-apps/$sentryAppIdOrSlug/features/', {
      path: {sentryAppIdOrSlug},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
