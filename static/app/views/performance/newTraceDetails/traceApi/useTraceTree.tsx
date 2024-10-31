import {useEffect, useState} from 'react';

import type {TraceSplitResults} from 'sentry/utils/performance/quickTrace/types';
import type {QueryStatus, UseApiQueryResult} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayRecord} from 'sentry/views/replays/types';

import {TraceTree} from '../traceModels/traceTree';

import type {TraceMetaQueryResults} from './useTraceMeta';

type UseTraceTreeParams = {
  meta: TraceMetaQueryResults;
  replay: ReplayRecord | null;
  trace: UseApiQueryResult<TraceSplitResults<TraceTree.Transaction> | undefined, any>;
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
      return;
    }

    if (
      trace?.data?.transactions.length === 0 &&
      trace?.data?.orphan_errors.length === 0
    ) {
      setTree(t => (t.type === 'empty' ? t : TraceTree.Empty()));
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
        replay: replay,
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
  ]);

  return tree;
}
