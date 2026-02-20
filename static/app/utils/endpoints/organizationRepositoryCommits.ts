// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationRepositoryCommitsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationRepositoryCommitsResponse>;
type TData = OrganizationRepositoryCommitsResponse;

/**
 * @public
 * List a Repository's Commits
 */
export function organizationRepositoryCommitsOptions(
  organization: Organization,
  repoId: string
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/repos/$repoId/commits/', {
      path: {organizationIdOrSlug: organization.slug, repoId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
