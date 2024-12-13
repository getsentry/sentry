import {useLayoutEffect, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import type {Client} from 'sentry/api';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {IssuesTraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/issuesTraceTree';

import {TraceTree} from './traceModels/traceTree';
import type {TracePreferencesState} from './traceState/tracePreferences';
import {useTraceState} from './traceState/traceStateProvider';
import {isTransactionNode} from './traceGuards';
import type {TraceReducerState} from './traceState';
import type {useTraceScrollToPath} from './useTraceScrollToPath';

// If a trace has less than 3 transactions, we automatically expand all transactions.
// We do this as the tree is otherwise likely to be very small and not very useful.
const AUTO_EXPAND_TRANSACTION_THRESHOLD = 3;
async function maybeAutoExpandTrace(
  tree: TraceTree,
  options: {
    api: Client;
    organization: Organization;
    preferences: Pick<TracePreferencesState, 'autogroup' | 'missing_instrumentation'>;
  }
): Promise<TraceTree> {
  const transactions = TraceTree.FindAll(tree.root, node => isTransactionNode(node));

  if (transactions.length >= AUTO_EXPAND_TRANSACTION_THRESHOLD) {
    return tree;
  }

  const promises: Promise<any>[] = [];
  for (const transaction of transactions) {
    promises.push(tree.zoom(transaction, true, options));
  }

  await Promise.allSettled(promises).catch(_e => {
    Sentry.withScope(scope => {
      scope.setFingerprint(['trace-auto-expand']);
      Sentry.captureMessage('Failed to auto expand trace with low transaction count');
    });
  });

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
  const api = useApi();
  const organization = useOrganization();
  const initializedRef = useRef<boolean>(false);
  const {tree, pathToNodeOrEventId, onTraceLoad} = options;

  const [status, setStatus] = useState<'success' | 'error' | 'pending' | 'idle'>('idle');

  const traceState = useTraceState();
  const traceStateRef = useRef<TraceReducerState>(traceState);
  traceStateRef.current = traceState;

  const traceStatePreferencesRef = useRef<
    Pick<TraceReducerState['preferences'], 'autogroup' | 'missing_instrumentation'>
  >(traceState.preferences);
  traceStatePreferencesRef.current = traceState.preferences;

  useLayoutEffect(() => {
    if (initializedRef.current) {
      return undefined;
    }

    if (tree.type !== 'trace') {
      return undefined;
    }

    let cancel = false;

    setStatus('pending');
    initializedRef.current = true;

    const expandOptions = {
      api,
      organization,
      preferences: traceStatePreferencesRef.current,
    };

    // Node path has higher specificity than eventId. If neither are provided, we check if the
    // trace should be automatically expanded
    const promise = pathToNodeOrEventId?.path
      ? TraceTree.ExpandToPath(tree, pathToNodeOrEventId.path, expandOptions)
      : pathToNodeOrEventId?.eventId
        ? TraceTree.ExpandToEventID(tree, pathToNodeOrEventId.eventId, expandOptions)
        : maybeAutoExpandTrace(tree, expandOptions);

    promise
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
  }, [tree, api, onTraceLoad, organization, pathToNodeOrEventId]);

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
  const api = useApi();
  const organization = useOrganization();
  const initializedRef = useRef<boolean>(false);
  const {tree, onTraceLoad} = options;

  const [status, setStatus] = useState<'success' | 'error' | 'pending' | 'idle'>('idle');

  const traceState = useTraceState();
  const traceStateRef = useRef<TraceReducerState>(traceState);
  traceStateRef.current = traceState;

  const traceStatePreferencesRef = useRef<
    Pick<TraceReducerState['preferences'], 'autogroup' | 'missing_instrumentation'>
  >(traceState.preferences);
  traceStatePreferencesRef.current = traceState.preferences;

  useLayoutEffect(() => {
    if (initializedRef.current) {
      return undefined;
    }

    if (tree.type !== 'trace') {
      return undefined;
    }

    let cancel = false;

    setStatus('pending');
    initializedRef.current = true;

    const expandOptions = {
      api,
      organization,
      preferences: traceStatePreferencesRef.current,
    };

    const promise = options.event
      ? IssuesTraceTree.ExpandToEvent(tree, options.event.eventID, expandOptions)
      : Promise.resolve();

    promise
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
  }, [tree, api, onTraceLoad, organization, options.event]);

  return status;
}
