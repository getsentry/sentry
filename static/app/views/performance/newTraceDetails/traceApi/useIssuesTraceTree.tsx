import {useEffect, useState} from 'react';

import type {QueryStatus, UseApiQueryResult} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {IssuesTraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/issuesTraceTree';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useTraceState} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import type {HydratedReplayRecord} from 'sentry/views/replays/types';

import {isEmptyTrace} from './utils';

type UseTraceTreeParams = {
  replay: HydratedReplayRecord | null;
  trace: UseApiQueryResult<TraceTree.Trace | undefined, any>;
  traceSlug?: string;
};

function getTraceViewQueryStatus(traceQueryStatus: QueryStatus): QueryStatus {
  if (traceQueryStatus === 'error') {
    return 'error';
  }

  if (traceQueryStatus === 'pending') {
    return 'pending';
  }

  return 'success';
}

export function useIssuesTraceTree({
  trace,
  replay,
  traceSlug,
}: UseTraceTreeParams): IssuesTraceTree {
  const api = useApi();
  const {projects} = useProjects();
  const traceState = useTraceState();
  const organization = useOrganization();

  const [tree, setTree] = useState<IssuesTraceTree>(IssuesTraceTree.Empty());

  useEffect(() => {
    const status = getTraceViewQueryStatus(trace.status);

    if (status === 'error') {
      setTree(t =>
        t.type === 'error'
          ? t
          : IssuesTraceTree.Error({
              project_slug: projects?.[0]?.slug ?? '',
              event_id: traceSlug,
            })
      );
      traceAnalytics.trackTraceErrorState(organization, 'issue_details');
      return;
    }

    if (trace.data && isEmptyTrace(trace.data)) {
      setTree(t => (t.type === 'empty' ? t : IssuesTraceTree.Empty()));
      traceAnalytics.trackTraceEmptyState(organization, 'issue_details');
      return;
    }

    if (status === 'pending') {
      setTree(t =>
        t.type === 'loading'
          ? t
          : IssuesTraceTree.Loading({
              project_slug: projects?.[0]?.slug ?? '',
              event_id: traceSlug,
            })
      );
      return;
    }

    if (trace.data) {
      const newTree = IssuesTraceTree.FromTrace(trace.data, {
        meta: null,
        replay,
        preferences: traceState.preferences,
      });

      setTree(newTree);
      newTree.build();
      return;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, organization, projects, replay, trace.status, trace.data, traceSlug]);

  return tree;
}
