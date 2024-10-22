import {useEffect, useMemo, useReducer, useRef, useState} from 'react';

import type {TraceSplitResults} from 'sentry/utils/performance/quickTrace/types';
import type {QueryStatus, UseApiQueryResult} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayRecord} from 'sentry/views/replays/types';

import {isTransactionNode} from '../traceGuards';
import {TraceTree} from '../traceModels/traceTree';

import type {TraceMetaQueryResults} from './useTraceMeta';

type UseTraceTreeParams = {
  metaResults: TraceMetaQueryResults;
  replayRecord: ReplayRecord | null;
  traceResults: UseApiQueryResult<
    TraceSplitResults<TraceTree.Transaction> | undefined,
    any
  >;
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
  traceResults,
  metaResults,
  traceSlug,
  replayRecord,
}: UseTraceTreeParams): TraceTree {
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();

  const [tree, setTree] = useState<TraceTree>(TraceTree.Empty());
  const loadingTraceRef = useRef<TraceTree | null>(null);
  const [_, rerender] = useReducer(x => (x + 1) % Number.MAX_SAFE_INTEGER, 0);

  const status = useMemo(() => {
    return getTraceViewQueryStatus(traceResults.status, metaResults.status);
  }, [traceResults.status, metaResults.status]);

  useEffect(() => {
    if (status === 'error') {
      const errorTree = TraceTree.Error({
        project_slug: projects?.[0]?.slug ?? '',
        event_id: traceSlug,
      });
      setTree(errorTree);
      return;
    }

    if (
      traceResults?.data?.transactions.length === 0 &&
      traceResults?.data?.orphan_errors.length === 0
    ) {
      setTree(TraceTree.Empty());
      return;
    }

    if (status === 'pending') {
      const loadingTrace =
        loadingTraceRef.current ??
        TraceTree.Loading({
          project_slug: projects?.[0]?.slug ?? '',
          event_id: traceSlug,
        });

      loadingTraceRef.current = loadingTrace;
      setTree(loadingTrace);
      return;
    }

    if (traceResults.data && metaResults.data) {
      const trace = TraceTree.FromTrace(traceResults.data, {
        meta: metaResults,
        replayRecord: replayRecord,
      });

      // Root frame + 2 nodes
      const promises: Promise<void>[] = [];
      const transactions = TraceTree.FindAll(trace.root, c => isTransactionNode(c));

      if (transactions.length <= 3) {
        for (const c of trace.list) {
          if (c.canFetch) {
            promises.push(trace.zoom(c, true, {api, organization}).then(rerender));
          }
        }
      }

      Promise.allSettled(promises).finally(() => {
        setTree(trace);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    api,
    organization,
    projects,
    replayRecord,
    status,
    metaResults.data,
    traceResults.data,
    traceSlug,
  ]);

  return tree;
}
