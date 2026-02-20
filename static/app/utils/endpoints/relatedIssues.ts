// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface RelatedIssuesResponse {
  data: unknown;
  meta: unknown;
  type: string;
}

type TQueryData = ApiResponse<RelatedIssuesResponse>;
type TData = RelatedIssuesResponse;

/**
 * @public
 * Retrieve related issues for a Group
 *         ````````````````````````````````````
 *         Related issues can be based on the same root cause or trace connected.
 *
 *         :pparam Request request: the request object
 *         :pparam Group group: the group object
 */
export function relatedIssuesOptions(issueId: string) {
  return queryOptions({
    queryKey: getQueryKey('/groups/$issueId/related-issues/', {
      path: {issueId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
