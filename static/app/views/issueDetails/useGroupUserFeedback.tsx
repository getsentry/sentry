import type {UserReport} from 'sentry/types/group';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface UseGroupUserFeedbackProps {
  groupId: string;
  query: {
    cursor?: string | undefined;
  };
}

export function useGroupUserFeedback({groupId, query}: UseGroupUserFeedbackProps) {
  const organization = useOrganization();

  return useApiQuery<UserReport[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/user-reports/', {
        path: {organizationIdOrSlug: organization.slug, issueId: groupId},
      }),
      {query},
    ],
    {
      staleTime: 0,
    }
  );
}
