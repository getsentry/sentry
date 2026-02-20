// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface BuiltinSymbolSourcesResponse {
  // No response keys detected — fill in manually
}

interface BuiltinSymbolSourcesQueryParams {
  platform?: string;
}

type TQueryData = ApiResponse<BuiltinSymbolSourcesResponse>;
type TData = BuiltinSymbolSourcesResponse;

/** @public */
export function builtinSymbolSourcesOptions(
  organization: Organization,
  query?: BuiltinSymbolSourcesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/builtin-symbol-sources/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
