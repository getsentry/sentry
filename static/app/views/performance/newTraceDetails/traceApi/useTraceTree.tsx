import {useMemo} from 'react';

import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import type {HydratedReplayRecord} from 'sentry/views/explore/replays/types';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useTraceState} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {isEmptyTrace} from './utils';

type UseTraceTreeParams = {
  replay: HydratedReplayRecord | null;
  trace: UseApiQueryResult<TraceTree.Trace | undefined, any>;
  traceSlug?: string;
};

export function useTraceTree({trace, replay, traceSlug}: UseTraceTreeParams): TraceTree {
  const {projects} = useProjects();
  const organization = useOrganization();
  const traceState = useTraceState();

  const tree = useMemo(() => {
    if (trace.status === 'error') {
      return TraceTree.ErrorState(
        {
          project_slug: projects?.[0]?.slug ?? '',
          event_id: traceSlug,
        },
        organization
      );
    }

    if (trace.data && isEmptyTrace(trace.data)) {
      return TraceTree.Empty();
    }

    if (trace.status === 'pending') {
      return TraceTree.Loading(
        {
          project_slug: projects?.[0]?.slug ?? '',
          event_id: traceSlug,
        },
        organization
      );
    }

    if (trace.data) {
      const newTree = TraceTree.FromTrace(trace.data, {
        meta: null,
        replay,
        preferences: traceState.preferences,
        organization,
      });
      newTree.build();
      return newTree;
    }

    return TraceTree.Empty();
  }, [
    organization,
    projects,
    replay,
    trace.status,
    trace.data,
    traceSlug,
    traceState.preferences,
  ]);

  return tree;
}
