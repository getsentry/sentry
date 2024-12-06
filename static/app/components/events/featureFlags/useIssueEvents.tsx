import type {Event} from '@sentry/types';

import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export default function useIssueEvents({issueId}: {issueId: string}) {
  const organization = useOrganization();
  return useApiQuery<Event[]>(
    [
      `/organizations/${organization.slug}/issues/${issueId}/events/`,
      {
        query: {
          statsPeriod: '14d',
          limit: 20,
          full: true,
        },
      },
    ],
    {staleTime: 0}
  );
}
