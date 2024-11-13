import {useEffect, useMemo} from 'react';

import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

import type {Visualize} from './useVisualizes';

export function useAnalytics({
  result,
  resultsMode,
  visualizes,
  organization,
  groupBys,
  userQuery,
}: {
  groupBys: string[];
  organization: Organization;
  result: ReturnType<typeof useSpansQuery>;
  resultsMode: 'sample' | 'aggregate';
  userQuery: string;
  visualizes: Visualize[];
}) {
  const params: {
    groupBys: string[];
    groupBys_count: number;
    has_results: boolean;
    organization: Organization;
    query_status: 'success' | 'error';
    results_mode: 'sample' | 'aggregate';
    user_queries: string;
    user_queries_count: number;
    visualizes: Visualize[];
    visualizes_count: number;
  } | null = useMemo(() => {
    if (result?.status === 'pending') {
      return null;
    }

    const search = new MutableSearch(userQuery);
    return {
      query_status: result?.status,
      results_mode: resultsMode,
      has_results: Array.isArray(result?.data) && result.data.length > 0,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes,
      visualizes_count: visualizes.length,
      organization,
      groupBys,
      groupBys_count: groupBys.filter(Boolean).length,
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.status, result.data, organization]);

  useEffect(() => {
    if (params) {
      trackAnalytics('trace.explorer.metadata', params);
    }
  }, [params]);
}
