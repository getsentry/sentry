import {useEffect, useState} from 'react';

import type {QueryStatus, UseApiQueryResult} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {IssuesTraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/issuesTraceTree';
import type {ReplayRecord} from 'sentry/views/replays/types';

import {traceAnalytics} from '../traceAnalytics';
import type {TraceTree} from '../traceModels/traceTree';

import type {TraceMetaQueryResults} from './useTraceMeta';
import {isEmptyTrace} from './utils';

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

export function useIssuesTraceTree({
  trace,
  meta,
  replay,
  traceSlug,
}: UseTraceTreeParams): IssuesTraceTree {
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();

  const [tree, setTree] = useState<IssuesTraceTree>(IssuesTraceTree.Empty());

  useEffect(() => {
    const status = getTraceViewQueryStatus(trace.status, meta.status);

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

    if (trace.data && meta.data) {
      const newTree = IssuesTraceTree.FromTrace(trace.data, {
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
  ]);

  return tree;
}
