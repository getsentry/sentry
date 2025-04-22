import type {AutofixRepoDefinition} from 'sentry/components/events/autofix/types';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

interface AutofixSetupRepoDefinition extends AutofixRepoDefinition {
  ok: boolean;
}

type AutofixSetupResponse = {
  genAIConsent: {
    ok: boolean;
  };
  integration: {
    ok: boolean;
    reason: string | null;
  };
  githubWriteIntegration?: {
    ok: boolean;
    repos: AutofixSetupRepoDefinition[];
  } | null;
};

function makeAutofixSetupQueryKey(
  groupId: string,
  checkWriteAccess?: boolean
): ApiQueryKey {
  return [
    `/issues/${groupId}/autofix/setup/${checkWriteAccess ? '?check_write_access=true' : ''}`,
  ];
}

export function useAutofixSetup(
  {groupId, checkWriteAccess}: {groupId: string; checkWriteAccess?: boolean},
  options: Omit<UseApiQueryOptions<AutofixSetupResponse, RequestError>, 'staleTime'> = {}
) {
  const queryData = useApiQuery<AutofixSetupResponse>(
    makeAutofixSetupQueryKey(groupId, checkWriteAccess),
    {
      enabled: Boolean(groupId),
      staleTime: 0,
      retry: false,
      ...options,
    }
  );

  return {
    ...queryData,
    canStartAutofix: Boolean(
      queryData.data?.integration.ok && queryData.data?.genAIConsent.ok
    ),
    canCreatePullRequests: Boolean(queryData.data?.githubWriteIntegration?.ok),
  };
}
