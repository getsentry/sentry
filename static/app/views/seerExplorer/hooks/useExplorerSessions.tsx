import {useMemo} from 'react';
import uniqBy from 'lodash/uniqBy';

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
  const {
    data,
    isFetching,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteApiQuery<RunsResponse>({
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

  // Deduplicate sessions in case pages shift (new runs, order changes).
  const sessions = useMemo(
    () => uniqBy(data?.pages.flatMap(result => result[0]?.data ?? []) ?? [], 'run_id'),
    [data]
  );

  return {
    sessions,
    isFetching,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  };
}
