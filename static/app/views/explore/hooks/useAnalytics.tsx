import {useEffect} from 'react';

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
  columns,
  userQuery,
}: {
  columns: string[];
  organization: Organization;
  result: ReturnType<typeof useSpansQuery>;
  resultsMode: 'sample' | 'aggregate';
  userQuery: string;
  visualizes: Visualize[];
}) {
  useEffect(() => {
    if (result.status === 'pending') {
      return;
    }

    const search = new MutableSearch(userQuery);
    const params = {
      query_status: result.status,
      results_mode: resultsMode,
      has_results: Array.isArray(result?.data) && result.data.length > 0,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes,
      visualizes_count: visualizes.length,
      organization,
      columns,
      columns_count: columns.filter(Boolean).length,
    };

    trackAnalytics('trace.explorer.metadata', params);
  }, [
    result.status,
    result.data,
    organization,
    resultsMode,
    visualizes,
    columns,
    userQuery,
  ]);
}
