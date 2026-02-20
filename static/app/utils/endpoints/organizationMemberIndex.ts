// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface OrganizationMemberIndexResponse {
  // No response keys detected — fill in manually
}

interface OrganizationMemberIndexQueryParams {
  expand?: string[];
  query?: string | MutableSearch;
}

type TQueryData = ApiResponse<OrganizationMemberIndexResponse>;
type TData = OrganizationMemberIndexResponse;

/**
 * @public
 * List all organization members.
 *
 *         Response includes pending invites that are approved by organization owners or managers but waiting to be accepted by the invitee.
 */
export function organizationMemberIndexOptions(
  organization: Organization,
  query?: OrganizationMemberIndexQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/members/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
