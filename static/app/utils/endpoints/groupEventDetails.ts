// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface GroupEventDetailsResponse {
  detail: unknown;
}

interface GroupEventDetailsQueryParams {
  /** The name of environments to filter by. */
  environment?: string[];
}

type TQueryData = ApiResponse<GroupEventDetailsResponse>;
type TData = GroupEventDetailsResponse;

/**
 * @public
 * Retrieves the details of an issue event.
 */
export function groupEventDetailsOptions(
  issueId: string,
  eventId: string,
  query?: GroupEventDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/issues/$issueId/events/$eventId/', {
      path: {issueId, eventId},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
