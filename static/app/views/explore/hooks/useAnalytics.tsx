import {useEffect} from 'react';

import type {Confidence, Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import type {Visualize} from './useVisualizes';

export function useAnalytics({
  resultLength,
  resultMissingRoot,
  resultMode,
  resultStatus,
  visualizes,
  organization,
  columns,
  userQuery,
  confidence,
}: {
  columns: string[];
  confidence: Confidence;
  organization: Organization;
  resultLength: number | undefined;
  resultMode: 'span samples' | 'trace samples' | 'aggregates';
  resultStatus: UseApiQueryResult<any, RequestError>['status'];
  userQuery: string;
  visualizes: Visualize[];
  resultMissingRoot?: number;
}) {
  useEffect(() => {
    if (resultStatus === 'pending') {
      return;
    }

    const search = new MutableSearch(userQuery);
    const params = {
      organization,
      columns,
      columns_count: columns.filter(Boolean).length,
      confidence,
      query_status: resultStatus,
      result_length: resultLength || 0,
      result_missing_root: resultMissingRoot || 0,
      result_mode: resultMode,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes,
      visualizes_count: visualizes.length,
    };

    trackAnalytics('trace.explorer.metadata', params);
  }, [
    organization,
    resultLength,
    resultMissingRoot,
    resultMode,
    resultStatus,
    visualizes,
    columns,
    userQuery,
    confidence,
  ]);
}
