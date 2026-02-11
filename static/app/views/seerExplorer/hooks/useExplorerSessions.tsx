import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {ExplorerSession} from 'sentry/views/seerExplorer/types';

interface SessionsResponse {
  data: ExplorerSession[];
}

export function useExplorerSessions({
  limit,
  enabled = true,
}: {
  limit: number;
  enabled?: boolean;
}) {
  const organization = useOrganization({allowNull: true});
  const query = useApiQuery<SessionsResponse>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/seer/explorer-runs/`, {
        path: {organizationIdOrSlug: organization?.slug ?? ''},
      }),
      {
        query: {
          per_page: limit,
        },
      },
    ],
    {
      staleTime: 10_000,
      enabled: enabled && Boolean(organization),
    }
  );

  return {
    ...query,
  };
}
