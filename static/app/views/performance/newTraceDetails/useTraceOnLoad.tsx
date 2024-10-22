import {useLayoutEffect, useRef} from 'react';
import * as Sentry from '@sentry/react';

import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types/organization';
import type {TraceSplitResults} from 'sentry/utils/performance/quickTrace/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/replays/types';

import type {TraceMetaQueryResults} from './traceApi/useTraceMeta';
import {TraceTree} from './traceModels/traceTree';
import type {TraceTreeNode} from './traceModels/traceTreeNode';
import type {TraceScheduler} from './traceRenderers/traceScheduler';
import {useTraceState} from './traceState/traceStateProvider';
import {isTransactionNode} from './traceGuards';
import type {TraceReducerState} from './traceState';
import type {useTraceScrollToPath} from './useTraceScrollToPath';

// If a trace has less than 3 transactions, we automatically expand all transactions.
// We do this as the tree is otherwise likely to be very small and not very useful.
const AUTO_EXPAND_TRANSACTION_THRESHOLD = 3;
async function maybeAutoExpandTrace(
  tree: TraceTree,
  api: Client,
  organization: Organization
): Promise<TraceTree> {
  const transactions = TraceTree.FindAll(tree.root, node => isTransactionNode(node));

  if (transactions.length >= AUTO_EXPAND_TRANSACTION_THRESHOLD) {
    return tree;
  }

  const promises: Promise<any>[] = [];
  for (const transaction of transactions) {
    promises.push(tree.zoom(transaction, true, {api, organization}));
  }

  await Promise.allSettled(promises).catch(_e => {
    Sentry.withScope(scope => {
      scope.setFingerprint(['trace-auto-expand']);
      Sentry.captureMessage('Failed to auto expand trace with low transaction count');
    });
  });

  return tree;
}

type UseTraceScrollToEventOnLoadProps = {
  meta: TraceMetaQueryResults;
  onTraceLoad: (
    trace: TraceTree,
    node: TraceTreeNode<TraceTree.NodeValue> | null,
    index: number | null
  ) => void;
  replay: ReplayRecord | null;
  scheduler: TraceScheduler;
  scrollQueueRef: ReturnType<typeof useTraceScrollToPath>;
  trace: UseApiQueryResult<TraceSplitResults<TraceTree.Transaction>, RequestError>;
};

export function useTraceOnLoad(options: UseTraceScrollToEventOnLoadProps) {
  const api = useApi();
  const organization = useOrganization();
  const initializedRef = useRef<boolean>(false);
  const {trace, meta, replay, onTraceLoad, scheduler, scrollQueueRef} = options;

  const traceState = useTraceState();
  const traceStateRef = useRef<TraceReducerState>(traceState);
  traceStateRef.current = traceState;

  useLayoutEffect(() => {
    if (initializedRef.current) {
      return undefined;
    }

    let cancel = false;
    function cleanup() {
      cancel = true;
    }

    if (trace.status === 'error' || meta.status === 'error') {
      initializedRef.current = true;
      onTraceLoad(
        TraceTree.Error({
          event_id: '',
          project_slug: '',
        }),
        null,
        null
      );
      return undefined;
    }

    if (trace.status === 'success' && meta.status === 'success') {
      initializedRef.current = true;

      if (!trace.data.transactions.length && !trace.data.orphan_errors.length) {
        onTraceLoad(TraceTree.Empty(), null, null);
        return undefined;
      }

      const tree = TraceTree.FromTrace(trace.data, {
        meta: meta.data,
        replay: replay,
      });

      maybeAutoExpandTrace(tree, api, organization).then(updatedTree => {
        if (cancel) {
          return;
        }

        // Node path has higher specificity than eventId
        const promise = scrollQueueRef.current?.path
          ? TraceTree.ExpandToPath(updatedTree, scrollQueueRef.current.path, {
              api,
              organization,
            })
          : scrollQueueRef.current?.eventId
            ? TraceTree.ExpandToEventID(updatedTree, scrollQueueRef.current?.eventId, {
                api,
                organization,
              })
            : Promise.resolve(null);

        promise
          .then(node => {
            if (cancel) {
              return;
            }

            if (!node) {
              Sentry.withScope(scope => {
                scope.setFingerprint(['trace-scroll-to']);
                Sentry.captureMessage('Failed to find and scroll to node in tree');
              });
            }
          })
          .finally(() => {
            // Important to set scrollQueueRef.current to null and trigger a rerender
            // after the promise resolves as we show a loading state during scroll,
            // else the screen could jump around while we fetch span data
            scrollQueueRef.current = null;
            // Allow react to rerender before dispatching the init event
            requestAnimationFrame(() => {
              scheduler.dispatch('initialize virtualized list');
            });
          });
      });

      return cleanup;
    }

    return undefined;
  }, [
    api,
    meta.data,
    trace.data,
    trace.status,
    meta.status,
    scheduler,
    scrollQueueRef,
    onTraceLoad,
    organization,
    replay,
  ]);
}
