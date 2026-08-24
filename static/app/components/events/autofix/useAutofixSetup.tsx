import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export interface AutofixSetupResponse {
  billing: {
    hasAutofixQuota: boolean;
  } | null;
  integration: {
    ok: boolean;
    reason: string | null;
  };
  seerReposLinked: boolean;
}

function makeAutofixSetupQueryKey(orgSlug: string, groupId: string): ApiQueryKey {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/', {
      path: {organizationIdOrSlug: orgSlug, issueId: groupId},
    }),
  ];
}

export function autofixSetupApiOptions({
  groupId,
  organizationSlug,
}: {
  groupId: string;
  organizationSlug: string;
}) {
  return {
    ...apiOptions.as<AutofixSetupResponse>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/',
      {
        path: {organizationIdOrSlug: organizationSlug, issueId: groupId},
        staleTime: 30_000,
      }
    ),
    retry: false,
  };
}

export function useAutofixSetup(
  {groupId}: {groupId: string},
  options: Omit<UseApiQueryOptions<AutofixSetupResponse>, 'staleTime'> = {}
) {
  const orgSlug = useOrganization().slug;

  const queryData = useApiQuery<AutofixSetupResponse>(
    makeAutofixSetupQueryKey(orgSlug, groupId),
    {
      enabled: Boolean(groupId),
      staleTime: 30_000,
      retry: false,
      ...options,
    }
  );

  return {
    ...queryData,
    canStartAutofix: Boolean(queryData.data?.integration.ok),
    hasAutofixQuota: Boolean(queryData.data?.billing?.hasAutofixQuota),
    seerReposLinked: Boolean(queryData.data?.seerReposLinked),
  };
}
