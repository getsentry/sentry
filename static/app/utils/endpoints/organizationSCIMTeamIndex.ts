// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationSCIMTeamIndexResponse {
  // No response keys detected — fill in manually
}

interface OrganizationSCIMTeamIndexQueryParams {
  /** The maximum number of results the query should return, maximum of 100. */
  count?: number;
  /** Fields that should be left off of return values. Right now the only supported field for this query is members. */
  excludedAttributes?: string[];
  /** A SCIM filter expression. The only operator currently supported is `eq`. */
  filter?: string;
  /** SCIM 1-offset based index for pagination. */
  startIndex?: number;
}

type TQueryData = ApiResponse<OrganizationSCIMTeamIndexResponse>;
type TData = OrganizationSCIMTeamIndexResponse;

/**
 * @public
 * Returns a paginated list of teams bound to a organization with a SCIM Groups GET Request.
 *
 *         Note that the members field will only contain up to 10,000 members.
 */
export function organizationSCIMTeamIndexOptions(
  organization: Organization,
  query?: OrganizationSCIMTeamIndexQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/scim/v2/Groups', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
