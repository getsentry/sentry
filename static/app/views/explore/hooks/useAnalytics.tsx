import {useEffect} from 'react';

import type {Confidence, Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {usePerformanceSubscriptionDetails} from 'sentry/views/performance/newTraceDetails/traceTypeWarnings/usePerformanceSubscriptionDetails';

export function useAnalytics({
  dataset,
  resultLength,
  resultMissingRoot,
  resultMode,
  resultStatus,
  visualizes,
  organization,
  columns,
  userQuery,
  confidence,
  title,
}: {
  columns: string[];
  confidence: Confidence;
  dataset: DiscoverDatasets;
  organization: Organization;
  resultLength: number | undefined;
  resultMode: 'span samples' | 'trace samples' | 'aggregates';
  resultStatus: UseApiQueryResult<any, RequestError>['status'];
  userQuery: string;
  visualizes: Visualize[];
  resultMissingRoot?: number;
  title?: string;
}) {
  const {
    data: {hasExceededPerformanceUsageLimit},
    isLoading: isLoadingSubscriptionDetails,
  } = usePerformanceSubscriptionDetails();

  useEffect(() => {
    if (resultStatus === 'pending' || isLoadingSubscriptionDetails) {
      return;
    }

    const search = new MutableSearch(userQuery);
    const params = {
      organization,
      columns,
      columns_count: columns.filter(Boolean).length,
      confidence,
      dataset,
      query_status: resultStatus,
      result_length: resultLength || 0,
      result_missing_root: resultMissingRoot || 0,
      result_mode: resultMode,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes,
      visualizes_count: visualizes.length,
      title,
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
    };

    trackAnalytics('trace.explorer.metadata', params);
  }, [
    organization,
    resultLength,
    resultMissingRoot,
    resultMode,
    isLoadingSubscriptionDetails,
    hasExceededPerformanceUsageLimit,
    resultStatus,
    visualizes,
    columns,
    userQuery,
    confidence,
    dataset,
    title,
  ]);
}
