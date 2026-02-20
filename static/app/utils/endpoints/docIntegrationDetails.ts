// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface DocIntegrationDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<DocIntegrationDetailsResponse>;
type TData = DocIntegrationDetailsResponse;

/** @public */
export function docIntegrationDetailsOptions(docIntegrationIdOrSlug: string) {
  return queryOptions({
    queryKey: getQueryKey('/doc-integrations/$docIntegrationIdOrSlug/', {
      path: {docIntegrationIdOrSlug},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
