import {useEffect, useMemo} from 'react';

import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
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
    has_results: boolean;
    organization: Organization;
    query_status: 'success' | 'error';
    results_mode: 'sample' | 'aggregate';
    user_query: string;
    visualizes: Visualize[];
  } | null = useMemo(() => {
    if (result?.status === 'pending') {
      return null;
    }

    return {
      query_status: result?.status,
      results_mode: resultsMode,
      has_results: Array.isArray(result?.data) && result.data.length > 0,
      user_query: userQuery,
      visualizes,
      organization,
      groupBys,
    };
  }, [result, visualizes, organization, groupBys, userQuery, resultsMode]);

  useEffect(() => {
    if (params) {
      trackAnalytics('trace.explorer.metadata', params);
    }
  }, [params]);
}
