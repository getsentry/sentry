import {useEffect, useState} from 'react';

import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {HydratedReplayRecord} from 'sentry/views/explore/replays/types';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useTraceState} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {isEmptyTrace} from './utils';

type UseTraceTreeParams = {
  replay: HydratedReplayRecord | null;
  trace: UseApiQueryResult<TraceTree.Trace | undefined, any>;
};

export function useTraceTree({trace, replay}: UseTraceTreeParams): TraceTree {
  const api = useApi();
  const organization = useOrganization();
  const traceState = useTraceState();

  const [tree, setTree] = useState(TraceTree.Empty());

  useEffect(() => {
    if (trace.status === 'error') {
      setTree(t => (t.type === 'error' ? t : TraceTree.ErrorState(organization)));

      return;
    }

    if (trace.data && isEmptyTrace(trace.data)) {
      setTree(t => (t.type === 'empty' ? t : TraceTree.Empty()));
      return;
    }

    if (trace.status === 'pending') {
      setTree(t => (t.type === 'loading' ? t : TraceTree.Loading(organization)));
      return;
    }

    if (trace.data) {
      const newTree = TraceTree.FromTrace(trace.data, {
        meta: null,
        replay,
        preferences: traceState.preferences,
        organization,
      });

      setTree(newTree);
      newTree.build();
      return;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, organization, replay, trace.status, trace.data]);

  return tree;
}
