// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface SentryAppWebhookRequestsResponse {
  detail: unknown;
}

interface SentryAppWebhookRequestsQueryParams {
  end?: string;
  errorsOnly?: boolean;
  eventType?: string;
  organizationSlug?: string;
  start?: string;
}

type TQueryData = ApiResponse<SentryAppWebhookRequestsResponse>;
type TData = SentryAppWebhookRequestsResponse;

/**
 * @public
 * :qparam string eventType: Optionally specify a specific event type to filter requests
 *         :qparam bool errorsOnly: If this is true, only return error/warning requests (300-599)
 *         :qparam string organizationSlug: Optionally specify an org slug to filter requests
 *         :qparam string start: Optionally specify a date to begin at. Format must be YYYY-MM-DD HH:MM:SS
 *         :qparam string end: Optionally specify a date to end at. Format must be YYYY-MM-DD HH:MM:SS
 */
export function sentryAppWebhookRequestsOptions(
  sentryAppIdOrSlug: string,
  query?: SentryAppWebhookRequestsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/sentry-apps/$sentryAppIdOrSlug/webhook-requests/', {
      path: {sentryAppIdOrSlug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
