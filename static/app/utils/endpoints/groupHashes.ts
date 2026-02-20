// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface GroupHashesResponse {
  // No response keys detected — fill in manually
}

interface GroupHashesQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
  /** If this is set to true, the event payload will include the full event body, including the stacktrace. Set to 1 to enable */
  full?: boolean;
}

type TQueryData = ApiResponse<GroupHashesResponse>;
type TData = GroupHashesResponse;

/**
 * @public
 * List an Issue's Hashes
 *         ``````````````````````
 *
 *         This endpoint lists an issue's hashes, which are the generated
 *         checksums used to aggregate individual events.
 *
 *         :pparam string issue_id: the ID of the issue to retrieve.
 *         :pparam bool full: If this is set to true, the event payload will include the full event body, including the stacktrace.
 *         :auth: required
 */
export function groupHashesOptions(
  organization: Organization,
  issueId: string,
  query?: GroupHashesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/issues/$issueId/hashes/',
      {
        path: {organizationIdOrSlug: organization.slug, issueId},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
