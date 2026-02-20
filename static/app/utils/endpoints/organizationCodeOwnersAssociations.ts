// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationCodeOwnersAssociationsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationCodeOwnersAssociationsQueryParams {
  provider?: string;
}

type TQueryData = ApiResponse<OrganizationCodeOwnersAssociationsResponse>;
type TData = OrganizationCodeOwnersAssociationsResponse;

/**
 * @public
 * Returns all ProjectCodeOwners associations for an organization as a dict with projects as keys
 *         e.g. {"projectSlug": {associations: {...}, errors: {...}}, ...]
 */
export function organizationCodeOwnersAssociationsOptions(
  organization: Organization,
  query?: OrganizationCodeOwnersAssociationsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/codeowners-associations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
