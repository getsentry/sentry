// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationAIConversationDetailsResponse {
  detail: unknown;
}

interface OrganizationAIConversationDetailsQueryParams {
  end?: string;
  environment?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationAIConversationDetailsResponse>;
type TData = OrganizationAIConversationDetailsResponse;

/** @public */
export function organizationAIConversationDetailsOptions(
  organization: Organization,
  conversationId: string,
  query?: OrganizationAIConversationDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/ai-conversations/$conversationId/',
      {
        path: {organizationIdOrSlug: organization.slug, conversationId},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
