// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationObjectstoreResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationObjectstoreResponse>;
type TData = OrganizationObjectstoreResponse;

/** @public */
export function organizationObjectstoreOptions(organization: Organization, path: string) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/objectstore/$path', {
      path: {organizationIdOrSlug: organization.slug, path},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
