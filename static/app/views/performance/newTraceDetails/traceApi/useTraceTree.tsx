import {useEffect, useState} from 'react';

import {isTraceSplitResult} from 'sentry/utils/performance/quickTrace/utils';
import type {QueryStatus, UseApiQueryResult} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayRecord} from 'sentry/views/replays/types';

import {traceAnalytics} from '../traceAnalytics';
import {TraceTree} from '../traceModels/traceTree';

import type {TraceMetaQueryResults} from './useTraceMeta';

type UseTraceTreeParams = {
  meta: TraceMetaQueryResults;
  replay: ReplayRecord | null;
  trace: UseApiQueryResult<TraceTree.Trace | undefined, any>;
  traceSlug?: string;
};

function getTraceViewQueryStatus(
  traceQueryStatus: QueryStatus,
  traceMetaQueryStatus: QueryStatus
): QueryStatus {
  if (traceQueryStatus === 'error' || traceMetaQueryStatus === 'error') {
    return 'error';
  }

  if (traceQueryStatus === 'pending' || traceMetaQueryStatus === 'pending') {
    return 'pending';
  }

  return 'success';
}

export function useTraceTree({
  trace,
  meta,
  replay,
  traceSlug,
}: UseTraceTreeParams): TraceTree {
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();

  const [tree, setTree] = useState<TraceTree>(TraceTree.Empty());

  const traceWaterfallSource = replay ? 'replay_details' : 'trace_view';

  useEffect(() => {
    const status = getTraceViewQueryStatus(trace.status, meta.status);

    if (status === 'error') {
      setTree(t =>
        t.type === 'error'
          ? t
          : TraceTree.Error({
              project_slug: projects?.[0]?.slug ?? '',
              event_id: traceSlug,
            })
      );
      traceAnalytics.trackTraceErrorState(organization, traceWaterfallSource);
      return;
    }

    if (
      trace.data &&
      (isTraceSplitResult(trace.data)
        ? trace.data?.transactions.length === 0 && trace.data?.orphan_errors.length === 0
        : trace.data?.length === 0)
    ) {
      setTree(t => (t.type === 'empty' ? t : TraceTree.Empty()));
      traceAnalytics.trackTraceEmptyState(organization, traceWaterfallSource);
      return;
    }

    if (status === 'pending') {
      setTree(t =>
        t.type === 'loading'
          ? t
          : TraceTree.Loading({
              project_slug: projects?.[0]?.slug ?? '',
              event_id: traceSlug,
            })
      );
      return;
    }

    if (trace.data && meta.data) {
      const newTree = TraceTree.FromTrace(trace.data, {
        meta: meta.data,
        replay,
      });

      setTree(newTree);
      newTree.build();
      return;
    }
  }, [
    api,
    organization,
    projects,
    replay,
    meta.status,
    trace.status,
    trace.data,
    meta.data,
    traceSlug,
    traceWaterfallSource,
  ]);

  return tree;
}
