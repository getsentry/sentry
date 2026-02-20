// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationSeerExplorerChatResponse {
  session: unknown;
}

type TQueryData = ApiResponse<OrganizationSeerExplorerChatResponse>;
type TData = OrganizationSeerExplorerChatResponse;

/**
 * @public
 * Get the current state of a Seer Explorer session.
 */
export function organizationSeerExplorerChatOptions(
  organization: Organization,
  runId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/seer/explorer-chat/$runId/',
      {
        path: {organizationIdOrSlug: organization.slug, runId},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
