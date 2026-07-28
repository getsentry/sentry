import {useMutation, useQueryClient, type InfiniteData} from '@tanstack/react-query';

import {IssueListCacheStore} from 'sentry/stores/IssueListCacheStore';
import type {Group} from 'sentry/types/group';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {groupQueryKey} from 'sentry/views/issueDetails/useGroup';

/**
 * Marks a group as seen from a surface that shows it in place, rather than by
 * navigating to issue details (which does it as a side effect of rendering).
 */
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
        (prev: ApiResponse<Group> | undefined) =>
          prev ? {...prev, json: {...prev.json, hasSeen: updatedGroup.hasSeen}} : prev
      );

      // Issue lists cache this URL both as InfiniteData and as a plain response.
      queryClient.setQueriesData(
        {queryKey: [issuesUrl], exact: false},
        (prev: InfiniteData<ApiResponse<Group[]>> | ApiResponse<Group[]> | undefined) => {
          if (!prev) {
            return prev;
          }

          const updateSeen = (groups: Group[]) =>
            groups.map(group =>
              group.id === groupId ? {...group, hasSeen: updatedGroup.hasSeen} : group
            );

          return 'pages' in prev
            ? {...prev, pages: prev.pages.map(p => ({...p, json: updateSeen(p.json)}))}
            : {...prev, json: updateSeen(prev.json)};
        }
      );

      if (updatedGroup.hasSeen) {
        IssueListCacheStore.markGroupAsSeen(groupId);
      }
    },
  });
}
