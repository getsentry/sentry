import type {SessionApiResponse} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useSessionProjectTotal() {
  const location = useLocation();
  const organization = useOrganization();
  const {
    data: projSessionData,
    isPending,
    isError,
  } = useApiQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {
        query: {
          ...location.query,
          field: ['sum(session)'],
          groupBy: ['project'],
        },
      },
    ],
    {staleTime: 0}
  );

  if (isPending || isError || !projSessionData) {
    return 0;
  }

  return projSessionData.groups[0]!.totals['sum(session)'] ?? 0;
}
