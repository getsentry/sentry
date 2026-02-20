// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationPullRequestDetailsResponse {
  error: unknown;
}

type TQueryData = ApiResponse<OrganizationPullRequestDetailsResponse>;
type TData = OrganizationPullRequestDetailsResponse;

/**
 * @public
 * Get files changed in a pull request and general information about the pull request.
 *         Returns normalized data that works across GitHub, GitLab, and Bitbucket.
 */
export function organizationPullRequestDetailsOptions(
  organization: Organization,
  repoName: string,
  prNumber: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/pullrequest-details/$repoName/$prNumber/',
      {
        path: {organizationIdOrSlug: organization.slug, repoName, prNumber},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
