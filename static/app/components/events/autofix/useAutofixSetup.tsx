import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

export type AutofixSetupResponse = {
  genAIConsent: {
    ok: boolean;
  };
  integration: {
    ok: boolean;
    reason: string | null;
  };
  subprocessorConsent: {
    ok: boolean;
  };
};

export function useAutofixSetup(
  {groupId}: {groupId: string},
  options: Omit<UseApiQueryOptions<AutofixSetupResponse, RequestError>, 'staleTime'> = {}
) {
  const queryData = useApiQuery<AutofixSetupResponse>(
    [`/issues/${groupId}/autofix/setup/`],
    {enabled: Boolean(groupId), staleTime: 0, retry: false, ...options}
  );

  return {
    ...queryData,
    hasSuccessfulSetup: Boolean(
      // TODO: Add other checks here when we can actually configure them
      queryData.data?.integration.ok
    ),
  };
}
