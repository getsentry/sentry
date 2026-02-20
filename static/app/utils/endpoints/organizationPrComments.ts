// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationPrCommentsResponse {
  error: unknown;
}

type TQueryData = ApiResponse<OrganizationPrCommentsResponse>;
type TData = OrganizationPrCommentsResponse;

/**
 * @public
 * Get GitHub comments for a Pull Request.
 *
 *         Returns both general PR comments and file-specific review comments.
 *
 *         **Path Parameters:**
 *         - `repo_name`: Repository name (e.g., 'owner/repo')
 *         - `pr_number`: Pull request number
 *
 *         **Example:**
 *         ```
 *         GET /projects/sentry/pr-comments/getsentry/sentry/12345/
 *         ```
 */
export function organizationPrCommentsOptions(
  organization: Organization,
  repoName: string,
  prNumber: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/pr-comments/$repoName/$prNumber/',
      {
        path: {organizationIdOrSlug: organization.slug, repoName, prNumber},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
