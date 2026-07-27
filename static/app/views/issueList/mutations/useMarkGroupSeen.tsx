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
 *
 * Fire-and-forget: a failed update leaves the indicator cleared until the next
 * refetch. `IssueListCacheStore` is updated for the old issue stream, which
 * doesn't read from react-query.
 */
export function useMarkGroupSeen() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const issuesUrl = getApiUrl('/organizations/$organizationIdOrSlug/issues/', {
    path: {organizationIdOrSlug: organization.slug},
  });

  return useMutation({
    mutationFn: (groupId: string) =>
      fetchMutation({
        method: 'PUT',
        url: getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/', {
          path: {organizationIdOrSlug: organization.slug, issueId: groupId},
        }),
        data: {hasSeen: true},
      }),
    onMutate: (groupId: string) => {
      queryClient.setQueriesData(
        {queryKey: groupQueryKey({organizationSlug: organization.slug, groupId})},
        (prev: ApiResponse<Group> | undefined) =>
          prev ? {...prev, json: {...prev.json, hasSeen: true}} : prev
      );

      // This URL is cached both as InfiniteData (paginated lists) and as a bare
      // ApiResponse (GroupList, feedback), and assuming either shape throws on
      // the other.
      queryClient.setQueriesData(
        {queryKey: [issuesUrl], exact: false},
        (prev: InfiniteData<ApiResponse<Group[]>> | ApiResponse<Group[]> | undefined) => {
          if (!prev) {
            return prev;
          }

          const markSeen = (groups: Group[]) =>
            groups.map(group =>
              group.id === groupId ? {...group, hasSeen: true} : group
            );

          if ('pages' in prev) {
            return {
              ...prev,
              pages: prev.pages.map(page => ({...page, json: markSeen(page.json)})),
            };
          }

          return {...prev, json: markSeen(prev.json)};
        }
      );

      IssueListCacheStore.markGroupAsSeen(groupId);
    },
  });
}
