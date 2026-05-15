import {useEffect} from 'react';

import {getRelativeDate} from 'sentry/components/timeSince';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {useProjects} from 'sentry/utils/useProjects';
import type {TraceQueryResult} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';

import {getTraceMetaSpanCount, type TraceMetaQueryResults} from './traceApi/useTraceMeta';
import {isEmptyTrace} from './traceApi/utils';
import type {TraceTree} from './traceModels/traceTree';
import {usePerformanceSubscriptionDetails} from './traceTypeWarnings/usePerformanceSubscriptionDetails';
import {traceAnalytics, type TraceTreeSource} from './traceAnalytics';
import {useTraceQueryParams} from './useTraceQueryParams';

type Options = {
  organization: Organization;
  trace: TraceQueryResult;
  traceTreeSource: TraceTreeSource;
  tree: TraceTree;
  meta?: TraceMetaQueryResults;
};

export function useTraceStateAnalytics({
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
  const metaSpanCount = getTraceMetaSpanCount(meta?.data);

  useEffect(() => {
    if (trace.status === 'pending' || meta?.status === 'pending') {
      return;
    }

    if (trace.status === 'error') {
      const errorStatus = trace.error?.status ?? null;

      traceAnalytics.trackTraceErrorState(
        organization,
        traceTreeSource,
        metaSpanCount ?? null,
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
    metaSpanCount,
    isLoadingSubscriptionDetails,
    tree,
    traceTreeSource,
    organization,
    projects,
    hasExceededPerformanceUsageLimit,
    timestamp,
  ]);
}
