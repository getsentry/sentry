import {useLayoutEffect, useState} from 'react';

import type {Event} from 'sentry/types/event';
import {IssuesTraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/issuesTraceTree';

import {TraceTree} from './traceModels/traceTree';
import type {useTraceScrollToPath} from './useTraceScrollToPath';

// If a trace has less than 3 transactions or less than 100 spans, we automatically expand all nodes.
// We do this as the tree is otherwise likely to be very small and not very useful.
const AUTO_EXPAND_TRANSACTIONS_THRESHOLD = 3;
const AUTO_EXPAND_SPANS_THRESHOLD = 100;
function maybeAutoExpandTrace(tree: TraceTree): TraceTree {
  const traceNode = tree.root.children[0];

  if (!traceNode) {
    return tree;
  }

  if (
    !(
      tree.collapsed_nodes < AUTO_EXPAND_TRANSACTIONS_THRESHOLD ||
      // We only collect the spans count for EAP traces atm, so we can't auto expand non-EAP traces
      // by spans count.
      (tree.eap_spans_count && tree.eap_spans_count < AUTO_EXPAND_SPANS_THRESHOLD)
    )
  ) {
    return tree;
  }

  const collapsedNodes = tree.root.findAllChildren(node => !node.expanded);
  for (const node of collapsedNodes) {
    node.expand(true, tree);
  }

  return tree;
}

type UseTraceScrollToEventOnLoadOptions = {
  onTraceLoad: () => void;
  pathToNodeOrEventId: ReturnType<typeof useTraceScrollToPath>['current'];
  tree: TraceTree;
};

export function useTraceOnLoad(
  options: UseTraceScrollToEventOnLoadOptions
): 'success' | 'error' | 'pending' | 'idle' {
  const {tree, pathToNodeOrEventId, onTraceLoad} = options;

  const [status, setStatus] = useState<'success' | 'error' | 'pending' | 'idle'>('idle');

  useLayoutEffect(() => {
    if (tree.type !== 'trace') {
      return;
    }

    let cancel = false;
    // oxlint-disable-next-line react/set-state-in-effect
    setStatus('pending');

    Promise.resolve(maybeAutoExpandTrace(tree))
      .then(() => {
        if (cancel) {
          return Promise.resolve();
        }

        // Node path has higher specificity than eventId
        const {path, eventId} = pathToNodeOrEventId || {};
        if (path) {
          return TraceTree.ExpandToPath(tree, path);
        }

        if (eventId) {
          return TraceTree.ExpandToEventID(tree, eventId);
        }

        return Promise.resolve();
      })
      .then(() => {
        if (cancel) {
          return;
        }
        setStatus('success');
        onTraceLoad();
      })
      .catch(() => {
        if (cancel) {
          return;
        }
        setStatus('error');
      });

    return () => {
      cancel = true;
    };
  }, [tree, onTraceLoad, pathToNodeOrEventId]);

  return status;
}

type UseTraceIssuesOnLoadOptions = {
  event: Event;
  onTraceLoad: () => void;
  tree: IssuesTraceTree;
};

export function useTraceIssuesOnLoad(
  options: UseTraceIssuesOnLoadOptions
): 'success' | 'error' | 'pending' | 'idle' {
  const {tree, onTraceLoad} = options;

  const [status, setStatus] = useState<'success' | 'error' | 'pending' | 'idle'>('idle');

  useLayoutEffect(() => {
    if (tree.type !== 'trace') {
      return;
    }

    let cancel = false;

    // oxlint-disable-next-line react/set-state-in-effect
    setStatus('pending');

    if (options.event) {
      IssuesTraceTree.ExpandToEvent(tree, options.event);
    }

    Promise.resolve()
      .then(() => {
        if (cancel) {
          return;
        }
        setStatus('success');
        onTraceLoad();
      })
      .catch(() => {
        if (cancel) {
          return;
        }
        setStatus('error');
      });

    return () => {
      cancel = true;
    };
  }, [tree, onTraceLoad, options.event]);

  return status;
}
