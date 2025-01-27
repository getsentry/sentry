import {useMemo} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useExploreDataset} from 'sentry/views/explore/contexts/pageParamsContext';
import {useTraces} from 'sentry/views/explore/hooks/useTraces';

interface UseExploreTracesTableOptions {
  enabled: boolean;
  limit: number;
  query: string;
}

export interface TracesTableResult {
  result: ReturnType<typeof useTraces>;
}

export function useExploreTracesTable({
  enabled,
  limit,
  query,
}: UseExploreTracesTableOptions): TracesTableResult {
  const location = useLocation();
  const cursor = decodeScalar(location.query.cursor);
  const dataset = useExploreDataset();

  const result = useTraces({
    enabled,
    dataset,
    query,
    limit,
    sort: '-timestamp',
    cursor,
  });

  return useMemo(() => {
    return {result};
  }, [result]);
}
