import {useCallback} from 'react';

import type {Group} from 'sentry/types/group';
import type {PlatformExternalIssue} from 'sentry/types/integrations';
import type {OrganizationSummary} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';

interface UseExternalIssuesOptions {
  group: Group;
  organization: OrganizationSummary;
}

function getExternalIssuesQueryKey({
  group,
  organization,
}: UseExternalIssuesOptions): ApiQueryKey {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/external-issues/', {
      path: {
        organizationIdOrSlug: organization.slug,
        issueId: group.id,
      },
    }),
  ];
}

export function useExternalIssues({group, organization}: UseExternalIssuesOptions) {
  const queryClient = useQueryClient();
  const {isPending, data = []} = useApiQuery<PlatformExternalIssue[]>(
    getExternalIssuesQueryKey({group, organization}),
    {staleTime: 60_000}
  );

  const onCreateExternalIssue = useCallback(
    (issue: PlatformExternalIssue) => {
      setApiQueryData<PlatformExternalIssue[]>(
        queryClient,
        getExternalIssuesQueryKey({group, organization}),
        existingIssues => existingIssues && [...existingIssues, issue]
      );
    },
    [queryClient, group, organization]
  );

  const onDeleteExternalIssue = useCallback(
    (issue: PlatformExternalIssue) => {
      setApiQueryData<PlatformExternalIssue[]>(
        queryClient,
        getExternalIssuesQueryKey({group, organization}),
        existingIssues => existingIssues?.filter(({id}) => id !== issue.id)
      );
    },
    [queryClient, group, organization]
  );

  return {
    onDeleteExternalIssue,
    onCreateExternalIssue,
    isLoading: isPending,
    data,
  };
}
