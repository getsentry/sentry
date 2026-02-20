// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationProjectsCountResponse {
  allProjects: unknown;
  myProjects: unknown;
}

type TQueryData = ApiResponse<OrganizationProjectsCountResponse>;
type TData = OrganizationProjectsCountResponse;

/** @public */
export function organizationProjectsCountOptions(organization: Organization) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/projects-count/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
