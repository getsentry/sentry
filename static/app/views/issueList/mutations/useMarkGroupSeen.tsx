import {useMutation, useQueryClient, type InfiniteData} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

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
      fetchMutation({
        method: 'PUT',
        url: getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/', {
          path: {organizationIdOrSlug: organization.slug, issueId: groupId},
        }),
        data: {hasSeen: true},
      }),
    onMutate: (groupId: string) => {
      // Issue lists cache this URL both as InfiniteData and as a plain response.
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

          return 'pages' in prev
            ? {...prev, pages: prev.pages.map(p => ({...p, json: markSeen(p.json)}))}
            : {...prev, json: markSeen(prev.json)};
        }
      );
    },
  });
}
