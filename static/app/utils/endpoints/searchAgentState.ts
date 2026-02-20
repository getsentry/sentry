// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface SearchAgentStateResponse {
  detail: unknown;
  session: unknown;
}

type TQueryData = ApiResponse<SearchAgentStateResponse>;
type TData = SearchAgentStateResponse;

/**
 * @public
 * Get the current state of a search agent run.
 *
 *         Args:
 *             run_id: The run ID returned from /search-agent/start/
 *
 *         Returns:
 *             {
 *                 "session": {
 *                     "run_id": int,
 *                     "status": "processing" | "completed" | "error",
 *                     "current_step": {"key": str} | null,
 *                     "completed_steps": [{"key": str}, ...],
 *                     "updated_at": str,
 *                     "final_response": {...} | null,  // Present when completed
 *                     "unsupported_reason": str | null  // Present on error
 *                 }
 *             }
 */
export function searchAgentStateOptions(organization: Organization, runId: string) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/search-agent/state/$runId/',
      {
        path: {organizationIdOrSlug: organization.slug, runId},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
