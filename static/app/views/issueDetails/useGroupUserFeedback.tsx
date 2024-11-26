import type {UserReport} from 'sentry/types/group';
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
    [`/organizations/${organization.slug}/issues/${groupId}/user-reports/`, {query}],
    {
      staleTime: 0,
    }
  );
}
