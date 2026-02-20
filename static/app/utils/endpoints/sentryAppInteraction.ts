// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface SentryAppInteractionResponse {
  componentInteractions: unknown;
  views: unknown;
}

type TQueryData = ApiResponse<SentryAppInteractionResponse>;
type TData = SentryAppInteractionResponse;

/**
 * @public
 * :qparam float since
 *         :qparam float until
 *         :qparam resolution - optional
 */
export function sentryAppInteractionOptions(sentryAppIdOrSlug: string) {
  return queryOptions({
    queryKey: getQueryKey('/sentry-apps/$sentryAppIdOrSlug/interaction/', {
      path: {sentryAppIdOrSlug},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
