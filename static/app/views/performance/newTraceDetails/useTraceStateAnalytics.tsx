import {useEffect} from 'react';

import {getRelativeDate} from 'sentry/components/timeSince';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useProjects from 'sentry/utils/useProjects';

import type {TraceMetaQueryResults} from './traceApi/useTraceMeta';
import {isEmptyTrace} from './traceApi/utils';
import type {TraceTree} from './traceModels/traceTree';
import {usePerformanceSubscriptionDetails} from './traceTypeWarnings/usePerformanceSubscriptionDetails';
import {traceAnalytics, type TraceTreeSource} from './traceAnalytics';
import {useTraceQueryParams} from './useTraceQueryParams';

type Options = {
  organization: Organization;
  trace: UseApiQueryResult<TraceTree.Trace, RequestError>;
  traceTreeSource: TraceTreeSource;
  tree: TraceTree;
  meta?: TraceMetaQueryResults;
};

function useTraceStateAnalytics({
  trace,
  meta,
  organization,
  traceTreeSource,
  tree,
}: Options) {
  const {projects} = useProjects();
  const {
    data: {hasExceededPerformanceUsageLimit},
    isLoading: isLoadingSubscriptionDetails,
  } = usePerformanceSubscriptionDetails({traceItemDataset: 'default'});
  const {timestamp} = useTraceQueryParams();

  useEffect(() => {
    if (trace.status === 'pending' || meta?.status === 'pending') {
      return;
    }

    if (trace.status === 'error') {
      const errorStatus = trace.error?.status ?? null;
      const metaSpansCount = meta?.data?.span_count ?? null;

      traceAnalytics.trackTraceErrorState(
        organization,
        traceTreeSource,
        metaSpansCount,
        errorStatus
      );
      return;
    }

    if (trace.data && isEmptyTrace(trace.data)) {
      traceAnalytics.trackTraceEmptyState(organization, traceTreeSource);
      return;
    }

    if (trace.data && tree.type === 'trace' && !isLoadingSubscriptionDetails) {
      const traceNode = tree.root.children[0];
      if (!traceNode) {
        return;
      }

      const traceTimestamp =
        traceNode.space?.[0] ?? (timestamp ? timestamp * 1000 : null);
      const traceAge = defined(traceTimestamp)
        ? getRelativeDate(traceTimestamp, 'ago')
        : 'unknown';
      const issuesCount = traceNode.uniqueIssues.length;

      traceAnalytics.trackTraceSuccessState(
        tree,
        projects,
        organization,
        hasExceededPerformanceUsageLimit,
        traceTreeSource,
        traceAge,
        issuesCount,
        tree.eap_spans_count
      );
    }
  }, [
    trace.status,
    trace.data,
    trace.error,
    meta?.status,
    meta?.data?.span_count,
    isLoadingSubscriptionDetails,
    tree,
    traceTreeSource,
    organization,
    projects,
    hasExceededPerformanceUsageLimit,
    timestamp,
  ]);
}

export default useTraceStateAnalytics;
