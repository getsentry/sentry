import {useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {isApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useInvalidateInboxQueries(groupId: string) {
  const queryClient = useQueryClient();
  const organization = useOrganization();

  return useCallback(() => {
    const issueListUrl = getApiUrl('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
    });
    const issueCountUrl = getApiUrl(
      '/organizations/$organizationIdOrSlug/issues-count/',
      {
        path: {organizationIdOrSlug: organization.slug},
      }
    );
    const issueActivitiesUrl = getApiUrl(
      '/organizations/$organizationIdOrSlug/issues/$issueId/activities/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          issueId: groupId,
        },
      }
    );

    void queryClient.invalidateQueries({
      predicate: query => {
        if (!isApiQueryKey(query.queryKey)) {
          return false;
        }
        const url = query.queryKey[1].fullUrl;
        return (
          url === issueListUrl || url === issueCountUrl || url === issueActivitiesUrl
        );
      },
    });
  }, [groupId, organization.slug, queryClient]);
}
