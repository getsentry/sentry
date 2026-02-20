// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface DataExportDetailsResponse {
  // No response keys detected — fill in manually
}

interface DataExportDetailsQueryParams {
  download?: string;
}

type TQueryData = ApiResponse<DataExportDetailsResponse>;
type TData = DataExportDetailsResponse;

/**
 * @public
 * Retrieve information about the temporary file record.
 *         Used to populate page emailed to the user.
 */
export function dataExportDetailsOptions(
  organization: Organization,
  dataExportId: string,
  query?: DataExportDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/data-export/$dataExportId/',
      {
        path: {organizationIdOrSlug: organization.slug, dataExportId},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
