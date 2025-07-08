import type {AutofixRepoDefinition} from 'sentry/components/events/autofix/types';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

interface AutofixSetupRepoDefinition extends AutofixRepoDefinition {
  ok: boolean;
}

export interface AutofixSetupResponse {
  billing: {
    hasAutofixQuota: boolean;
  } | null;
  integration: {
    ok: boolean;
    reason: string | null;
  };
  setupAcknowledgement: {
    orgHasAcknowledged: boolean;
    userHasAcknowledged: boolean;
  };
  githubWriteIntegration?: {
    ok: boolean;
    repos: AutofixSetupRepoDefinition[];
  } | null;
}

function makeAutofixSetupQueryKey(
  orgSlug: string,
  groupId: string,
  checkWriteAccess?: boolean
): ApiQueryKey {
  return [
    `/organizations/${orgSlug}/issues/${groupId}/autofix/setup/${checkWriteAccess ? '?check_write_access=true' : ''}`,
  ];
}

export function useAutofixSetup(
  {groupId, checkWriteAccess}: {groupId: string; checkWriteAccess?: boolean},
  options: Omit<UseApiQueryOptions<AutofixSetupResponse, RequestError>, 'staleTime'> = {}
) {
  const orgSlug = useOrganization().slug;

  const queryData = useApiQuery<AutofixSetupResponse>(
    makeAutofixSetupQueryKey(orgSlug, groupId, checkWriteAccess),
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
      queryData.data?.integration.ok &&
        queryData.data?.setupAcknowledgement.orgHasAcknowledged
    ),
    canCreatePullRequests: Boolean(queryData.data?.githubWriteIntegration?.ok),
    hasAutofixQuota: Boolean(queryData.data?.billing?.hasAutofixQuota),
  };
}
