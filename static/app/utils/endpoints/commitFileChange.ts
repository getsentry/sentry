// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface CommitFileChangeResponse {
  // No response keys detected — fill in manually
}

interface CommitFileChangeQueryParams {
  repo_id?: string;
  repo_name?: string;
}

type TQueryData = ApiResponse<CommitFileChangeResponse>;
type TData = CommitFileChangeResponse;

/**
 * @public
 * Retrieve Files Changed in a Release's Commits
 *         `````````````````````````````````````````````
 *
 *         Retrieve a list of files that were changed in a given release's commits.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           release belongs to.
 *         :pparam string version: the version identifier of the release.
 *
 *         :pparam string repo_name: the repository name
 *
 *         :auth: required
 */
export function commitFileChangeOptions(
  organization: Organization,
  version: string,
  query?: CommitFileChangeQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/releases/$version/commitfiles/',
      {
        path: {organizationIdOrSlug: organization.slug, version},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
