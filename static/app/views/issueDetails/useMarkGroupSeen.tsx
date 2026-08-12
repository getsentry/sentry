import {useMutation, useQueryClient, type InfiniteData} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {groupQueryKey} from 'sentry/views/issueDetails/useGroup';

export function useMarkGroupSeen() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const issuesUrl = getApiUrl('/organizations/$organizationIdOrSlug/issues/', {
    path: {organizationIdOrSlug: organization.slug},
  });

  return useMutation({
    mutationFn: (groupId: string) =>
      fetchMutation<Group>({
        method: 'PUT',
        url: getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/', {
          path: {organizationIdOrSlug: organization.slug, issueId: groupId},
        }),
        data: {hasSeen: true},
      }),
    onSuccess: (updatedGroup, groupId) => {
      queryClient.setQueriesData(
        {queryKey: groupQueryKey({organizationSlug: organization.slug, groupId})},
        (previous: ApiResponse<Group> | undefined) =>
          previous
            ? {...previous, json: {...previous.json, hasSeen: updatedGroup.hasSeen}}
            : previous
      );

      // Inbox sections are infinite queries against the organization issues endpoint.
      queryClient.setQueriesData<InfiniteData<ApiResponse<Group[]>>>(
        {
          queryKey: [issuesUrl],
          predicate: query => safeParseQueryKey(query.queryKey)?.isInfinite === true,
        },
        previous =>
          previous
            ? {
                ...previous,
                pages: previous.pages.map(page => ({
                  ...page,
                  json: page.json.map(group =>
                    group.id === groupId
                      ? {...group, hasSeen: updatedGroup.hasSeen}
                      : group
                  ),
                })),
              }
            : previous
      );

      void queryClient.invalidateQueries({queryKey: [issuesUrl], refetchType: 'none'});
    },
  });
}
