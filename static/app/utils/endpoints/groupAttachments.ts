// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface GroupAttachmentsResponse {
  // No response keys detected — fill in manually
}

interface GroupAttachmentsQueryParams {
  end?: string;
  event_id?: string[];
  start?: string;
  statsPeriod?: string;
  types?: string[];
  utc?: string;
}

type TQueryData = ApiResponse<GroupAttachmentsResponse>;
type TData = GroupAttachmentsResponse;

/**
 * @public
 * List Event Attachments
 *         ``````````````````````
 *
 *         Returns a list of event attachments for an issue.
 *
 *         :pparam string issue_id: the ID of the issue to retrieve.
 *         :pparam list   types:    a list of attachment types to filter for.
 *         :qparam string start: Beginning date. You must also provide ``end``.
 *         :qparam string end: End date. You must also provide ``start``.
 *         :qparam string statsPeriod: An optional stat period (defaults to ``"90d"``).
 *         :qparam string query: If set, will filter to only attachments from events matching that query.
 *         :qparam string environment: If set, will filter to only attachments from events within a specific environment.
 *         :auth: required
 */
export function groupAttachmentsOptions(
  issueId: string,
  query?: GroupAttachmentsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/groups/$issueId/attachments/', {
      path: {issueId},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
