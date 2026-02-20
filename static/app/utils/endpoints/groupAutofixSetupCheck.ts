// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface GroupAutofixSetupCheckResponse {
  autofixEnabled: unknown;
  billing: unknown;
  githubWriteIntegration: unknown;
  integration: unknown;
  seerReposLinked: unknown;
  setupAcknowledgement: unknown;
}

interface GroupAutofixSetupCheckQueryParams {
  check_write_access?: string;
}

type TQueryData = ApiResponse<GroupAutofixSetupCheckResponse>;
type TData = GroupAutofixSetupCheckResponse;

/**
 * @public
 * Checks if we are able to run Autofix on the given group.
 */
export function groupAutofixSetupCheckOptions(
  issueId: string,
  query?: GroupAutofixSetupCheckQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/groups/$issueId/autofix/setup/', {
      path: {issueId},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
