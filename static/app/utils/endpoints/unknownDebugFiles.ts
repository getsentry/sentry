// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface UnknownDebugFilesResponse {
  missing: unknown;
}

interface UnknownDebugFilesQueryParams {
  checksums?: string[];
}

type TQueryData = ApiResponse<UnknownDebugFilesResponse>;
type TData = UnknownDebugFilesResponse;

/** @public */
export function unknownDebugFilesOptions(
  organization: Organization,
  project: Project,
  query?: UnknownDebugFilesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/files/dsyms/unknown/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
