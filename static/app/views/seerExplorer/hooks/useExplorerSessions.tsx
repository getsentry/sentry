import {useMemo} from 'react';
import uniqBy from 'lodash/uniqBy';

import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {ExplorerSession} from 'sentry/views/seerExplorer/types';

interface SeerResponse {
  data: ExplorerSession[];
}

export function useExplorerSessions({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  const organization = useOrganization();

  const queryResult = useInfiniteApiQuery<SeerResponse>({
    queryKey: ['infinite', `/organizations/${organization.slug}/seer/explorer-runs/`],
    enabled: enabled && Boolean(organization),
    staleTime: 30_000, // 30 seconds
  });

  // Deduplicate sessions in case pages overlap
  // Access result[0].data since response format is {"data": list[item]}
  const sessions = useMemo(
    () =>
      uniqBy(
        queryResult.data?.pages.flatMap(result => result[0]?.data ?? []) ?? [],
        'run_id'
      ),
    [queryResult.data?.pages]
  );

  return {
    sessions,
    isFetching: queryResult.isFetching,
    isError: queryResult.isError,
  };
}
