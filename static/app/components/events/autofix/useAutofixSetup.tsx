import {useQuery, type UseQueryOptions} from '@tanstack/react-query';

import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
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

export function autofixSetupApiOptions({
  groupId,
  organizationSlug,
}: {
  groupId: string;
  organizationSlug: string;
}) {
  return apiOptions.as<AutofixSetupResponse>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/',
    {
      path: {organizationIdOrSlug: organizationSlug, issueId: groupId},
      staleTime: 30_000,
    }
  );
}

export function useAutofixSetup(
  {groupId}: {groupId: string},
  options: Omit<
    UseQueryOptions<
      ApiResponse<AutofixSetupResponse>,
      Error,
      AutofixSetupResponse,
      ApiQueryKey
    >,
    'staleTime' | 'queryKey' | 'queryFn' | 'select'
  > = {}
) {
  const orgSlug = useOrganization().slug;

  const queryData = useQuery({
    ...autofixSetupApiOptions({organizationSlug: orgSlug, groupId}),
    enabled: Boolean(groupId),
    staleTime: 30_000,
    retry: false,
    ...options,
  });

  return {
    data: queryData.data,
    isPending: queryData.isPending,
    refetch: queryData.refetch,
    canStartAutofix: Boolean(queryData.data?.integration.ok),
    hasAutofixQuota: Boolean(queryData.data?.billing?.hasAutofixQuota),
    seerReposLinked: Boolean(queryData.data?.seerReposLinked),
  };
}
