import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export type IssueCounts = {string: number};

export function useIssueCounts(eventView, transactions) {
  const organization = useOrganization();

  const queryParameters = {
    query: transactions,
    project: eventView.project,
    start: eventView.start,
    end: eventView.end,
    statsPeriod: eventView.statsPeriod,
  };

  return useApiQuery<IssueCounts[]>(
    [
      `/organizations/${organization.slug}/issues-count/`,
      {
        query: queryParameters,
      },
    ],
    {
      staleTime: Infinity,
      enabled: transactions.length > 0,
    }
  );
}
