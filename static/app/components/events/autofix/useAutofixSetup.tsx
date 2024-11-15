import type {AutofixRepoDefinition} from 'sentry/components/events/autofix/types';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

export interface AutofixSetupRepoDefinition extends AutofixRepoDefinition {
  ok: boolean;
}

export type AutofixSetupResponse = {
  autofixEnabled: {
    ok: boolean;
  };
  genAIConsent: {
    ok: boolean;
  };
  githubWriteIntegration: {
    ok: boolean;
    repos: AutofixSetupRepoDefinition[];
  };
  integration: {
    ok: boolean;
    reason: string | null;
  };
  subprocessorConsent: {
    ok: boolean;
  };
};

export function makeAutofixSetupQueryKey(groupId: string): ApiQueryKey {
  return [`/issues/${groupId}/autofix/setup/`];
}

export function useAutofixSetup(
  {groupId}: {groupId: string},
  options: Omit<UseApiQueryOptions<AutofixSetupResponse, RequestError>, 'staleTime'> = {}
) {
  const queryData = useApiQuery<AutofixSetupResponse>(makeAutofixSetupQueryKey(groupId), {
    enabled: Boolean(groupId),
    staleTime: 0,
    retry: false,
    ...options,
  });

  return {
    ...queryData,
    canStartAutofix: Boolean(
      queryData.data?.integration.ok && queryData.data?.genAIConsent.ok
    ),
    canCreatePullRequests: Boolean(queryData.data?.githubWriteIntegration.ok),
  };
}
