import {useMemo} from 'react';

import {DEFAULT_PER_PAGE} from 'sentry/constants';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useExploreDataset} from 'sentry/views/explore/contexts/pageParamsContext';
import {useTraces} from 'sentry/views/explore/hooks/useTraces';

interface UseExploreTracesTableOptions {
  enabled: boolean;
  query: string;
}

export interface TracesTableResult {
  result: ReturnType<typeof useTraces>;
}

export function useExploreTracesTable({
  enabled,
  query,
}: UseExploreTracesTableOptions): TracesTableResult {
  const location = useLocation();
  const cursor = decodeScalar(location.query.cursor);
  const dataset = useExploreDataset();

  const result = useTraces({
    enabled,
    dataset,
    query,
    limit: DEFAULT_PER_PAGE,
    sort: '-timestamp',
    cursor,
  });

  return useMemo(() => {
    return {result};
  }, [result]);
}
