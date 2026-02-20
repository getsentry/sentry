// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationSamplingProjectRatesResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationSamplingProjectRatesResponse>;
type TData = OrganizationSamplingProjectRatesResponse;

/**
 * @public
 * List Sampling Rates for Projects
 *         ````````````````````````````````
 *
 *         Return a list of sampling rates for projects in the organization by
 *         project ID.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the
 *             organization.
 *         :auth: required
 */
export function organizationSamplingProjectRatesOptions(organization: Organization) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/sampling/project-rates/',
      {
        path: {organizationIdOrSlug: organization.slug},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
