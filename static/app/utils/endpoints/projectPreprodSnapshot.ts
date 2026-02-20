// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectPreprodSnapshotResponse {
  detail: unknown;
}

interface ProjectPreprodSnapshotQueryParams {
  limit?: string;
  offset?: string;
}

type TQueryData = ApiResponse<ProjectPreprodSnapshotResponse>;
type TData = ProjectPreprodSnapshotResponse;

/**
 * @public
 * Retrieves snapshot data
 */
export function projectPreprodSnapshotOptions(
  organization: Organization,
  project: Project,
  snapshotId: string,
  query?: ProjectPreprodSnapshotQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/preprodartifacts/snapshots/$snapshotId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          snapshotId,
        },
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
