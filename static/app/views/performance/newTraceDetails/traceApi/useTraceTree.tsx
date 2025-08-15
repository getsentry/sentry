import {useEffect, useState} from 'react';

import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useTraceState} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import type {HydratedReplayRecord} from 'sentry/views/replays/types';

import {isEmptyTrace} from './utils';

type UseTraceTreeParams = {
  replay: HydratedReplayRecord | null;
  trace: UseApiQueryResult<TraceTree.Trace | undefined, any>;
  traceSlug?: string;
};

export function useTraceTree({trace, replay, traceSlug}: UseTraceTreeParams): TraceTree {
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();
  const traceState = useTraceState();

  const [tree, setTree] = useState<TraceTree>(TraceTree.Empty());

  const traceWaterfallSource = replay ? 'replay_details' : 'trace_view';

  useEffect(() => {
    if (trace.status === 'error') {
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

    if (trace.data && isEmptyTrace(trace.data)) {
      setTree(t => (t.type === 'empty' ? t : TraceTree.Empty()));
      traceAnalytics.trackTraceEmptyState(organization, traceWaterfallSource);
      return;
    }

    if (trace.status === 'pending') {
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

    if (trace.data) {
      const newTree = TraceTree.FromTrace(trace.data, {
        meta: null,
        replay,
        preferences: traceState.preferences,
      });

      setTree(newTree);
      newTree.build();
      return;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    api,
    organization,
    projects,
    replay,
    trace.status,
    trace.data,
    traceSlug,
    traceWaterfallSource,
  ]);

  return tree;
}
