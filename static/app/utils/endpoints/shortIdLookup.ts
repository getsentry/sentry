// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ShortIdLookupResponse {
  group: unknown;
  groupId: string | number;
  organizationSlug: string;
  projectSlug: string;
  shortId: string | number;
}

type TQueryData = ApiResponse<ShortIdLookupResponse>;
type TData = ShortIdLookupResponse;

/**
 * @public
 * Resolve a short ID to the project slug and group details.
 */
export function shortIdLookupOptions(organization: Organization, issueId: string) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/shortids/$issueId/', {
      path: {organizationIdOrSlug: organization.slug, issueId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
