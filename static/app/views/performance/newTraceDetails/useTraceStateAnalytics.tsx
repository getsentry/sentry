import {useEffect} from 'react';

import {getRelativeDate} from 'sentry/components/timeSince';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useProjects from 'sentry/utils/useProjects';

import type {TraceMetaQueryResults} from './traceApi/useTraceMeta';
import {isEmptyTrace} from './traceApi/utils';
import {TraceTree} from './traceModels/traceTree';
import {usePerformanceSubscriptionDetails} from './traceTypeWarnings/usePerformanceSubscriptionDetails';
import {traceAnalytics, type TraceWaterFallSource} from './traceAnalytics';
import {useTraceQueryParams} from './useTraceQueryParams';

type Options = {
  organization: Organization;
  trace: UseApiQueryResult<TraceTree.Trace, RequestError>;
  traceWaterfallSource: TraceWaterFallSource;
  tree: TraceTree;
  meta?: TraceMetaQueryResults;
};

function useTraceStateAnalytics({
  trace,
  meta,
  organization,
  traceWaterfallSource,
  tree,
}: Options) {
  const {projects} = useProjects();
  const {
    data: {hasExceededPerformanceUsageLimit},
    isLoading: isLoadingSubscriptionDetails,
  } = usePerformanceSubscriptionDetails();
  const {timestamp} = useTraceQueryParams();

  useEffect(() => {
    if (trace.status === 'pending') {
      return;
    }

    if (trace.status === 'error') {
      const errorStatus = trace.error?.status ?? null;
      const metaSpansCount = meta?.data?.span_count ?? null;

      traceAnalytics.trackTraceErrorState(
        organization,
        traceWaterfallSource,
        metaSpansCount,
        errorStatus
      );
      return;
    }

    if (trace.data && isEmptyTrace(trace.data)) {
      traceAnalytics.trackTraceEmptyState(organization, traceWaterfallSource);
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
      const issuesCount = TraceTree.UniqueIssues(traceNode).length;

      traceAnalytics.trackTraceShape(
        tree,
        projects,
        organization,
        hasExceededPerformanceUsageLimit,
        traceWaterfallSource,
        traceAge,
        issuesCount,
        tree.eap_spans_count
      );
    }
  }, [
    trace.status,
    trace.data,
    trace.error,
    meta,
    isLoadingSubscriptionDetails,
    tree,
    traceWaterfallSource,
    organization,
    projects,
    hasExceededPerformanceUsageLimit,
    timestamp,
  ]);
}

export default useTraceStateAnalytics;
