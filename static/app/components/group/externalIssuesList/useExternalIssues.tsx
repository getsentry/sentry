import {useCallback} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import type {PlatformExternalIssue} from 'sentry/types/integrations';
import type {OrganizationSummary} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

interface UseExternalIssuesOptions {
  group: Group;
  organization: OrganizationSummary;
}

function externalIssuesOptions({group, organization}: UseExternalIssuesOptions) {
  return apiOptions.as<PlatformExternalIssue[]>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/external-issues/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        issueId: group.id,
      },
      staleTime: 60_000,
    }
  );
}

export function useExternalIssues({group, organization}: UseExternalIssuesOptions) {
  const queryClient = useQueryClient();
  const {isPending, data = []} = useQuery(externalIssuesOptions({group, organization}));

  const onCreateExternalIssue = useCallback(
    (issue: PlatformExternalIssue) => {
      queryClient.setQueryData(
        externalIssuesOptions({group, organization}).queryKey,
        existingIssues =>
          existingIssues && {...existingIssues, json: [...existingIssues.json, issue]}
      );
    },
    [queryClient, group, organization]
  );

  const onDeleteExternalIssue = useCallback(
    (issue: PlatformExternalIssue) => {
      queryClient.setQueryData(
        externalIssuesOptions({group, organization}).queryKey,
        existingIssues =>
          existingIssues && {
            ...existingIssues,
            json: existingIssues.json.filter(({id}) => id !== issue.id),
          }
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
