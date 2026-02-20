// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface GroupIntegrationDetailsResponse {
  detail: unknown;
}

interface GroupIntegrationDetailsQueryParams {
  action?: string;
}

type TQueryData = ApiResponse<GroupIntegrationDetailsResponse>;
type TData = GroupIntegrationDetailsResponse;

/**
 * @public
 * Retrieves the config needed to either link or create an external issue for a group.
 */
export function groupIntegrationDetailsOptions(
  issueId: string,
  integrationId: string,
  query?: GroupIntegrationDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/groups/$issueId/integrations/$integrationId/', {
      path: {issueId, integrationId},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
