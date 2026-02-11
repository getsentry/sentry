import {useMemo} from 'react';

import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useTraces} from 'sentry/views/explore/hooks/useTraces';

interface UseExploreTracesTableOptions {
  enabled: boolean;
  limit: number;
  query: string;
  queryExtras?: {
    caseInsensitive?: CaseInsensitive;
    logQuery?: string[];
    metricQuery?: string[];
    spanQuery?: string[];
  };
}

export interface TracesTableResult {
  result: ReturnType<typeof useTraces>;
}

export function useExploreTracesTable({
  enabled,
  limit,
  query,
  queryExtras,
}: UseExploreTracesTableOptions): TracesTableResult {
  const location = useLocation();
  const cursor = decodeScalar(location.query.cursor);

  const result = useTraces({
    enabled,
    query,
    limit,
    sort: '-timestamp',
    cursor,
    caseInsensitive: queryExtras?.caseInsensitive,
    logQuery: queryExtras?.logQuery,
    metricQuery: queryExtras?.metricQuery,
    spanQuery: queryExtras?.spanQuery,
  });

  return useMemo(() => {
    return {result};
  }, [result]);
}
