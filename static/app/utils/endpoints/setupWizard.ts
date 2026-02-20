// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface SetupWizardResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<SetupWizardResponse>;
type TData = SetupWizardResponse;

/**
 * @public
 * This tries to retrieve and return the cache content if possible
 *         otherwise creates new cache
 */
export function setupWizardOptions(wizardHash: string) {
  return queryOptions({
    queryKey: getQueryKey('/wizard/$wizardHash/', {
      path: {wizardHash},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
