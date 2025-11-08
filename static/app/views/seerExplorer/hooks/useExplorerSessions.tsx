import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {ExplorerSession} from 'sentry/views/seerExplorer/types';

interface RunsResponse {
  data: ExplorerSession[];
}

export function useExplorerSessions({
  perPage,
  enabled = true,
}: {
  perPage: number;
  enabled?: boolean;
}) {
  const organization = useOrganization({allowNull: true});
  const query = useInfiniteApiQuery<RunsResponse>({
    queryKey: [
      'infinite',
      `/organizations/${organization?.slug ?? ''}/seer/explorer-runs/`,
      {
        query: {
          per_page: perPage,
        },
      },
    ],
    enabled: enabled && Boolean(organization),
  });

  // // Deduplicate sessions in case pages shift (new runs, order changes).
  // const sessions = useMemo(
  //   () =>
  //     uniqBy(query.data?.pages.flatMap(result => result[0]?.data ?? []) ?? [], 'run_id'),
  //   [query.data]
  // );

  return {
    ...query,
  };
}
