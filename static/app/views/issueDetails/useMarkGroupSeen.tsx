import {useMutation, useQueryClient} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
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

      return queryClient.invalidateQueries({queryKey: [issuesUrl]});
    },
  });
}
