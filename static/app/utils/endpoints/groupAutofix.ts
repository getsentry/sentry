// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface GroupAutofixResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<GroupAutofixResponse>;
type TData = GroupAutofixResponse;

/**
 * @public
 * Retrieve the current detailed state of an issue fix process for a specific issue including:
 *
 *         - Current status
 *         - Steps performed and their outcomes
 *         - Repository information and permissions
 *         - Root Cause Analysis
 *         - Proposed Solution
 *         - Generated code changes
 *
 *         This endpoint although documented is still experimental and the payload may change in the future.
 */
export function groupAutofixOptions(issueId: string) {
  return queryOptions({
    queryKey: getQueryKey('/groups/$issueId/autofix/', {
      path: {issueId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
