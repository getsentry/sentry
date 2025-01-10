import * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';

import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isSpanNode,
  isTraceErrorNode,
  isTraceNode,
  isTransactionNode,
} from '../traceGuards';
import type {TraceTree} from '../traceModels/traceTree';
import type {TraceTreeNode} from '../traceModels/traceTreeNode';
import {traceReducerExhaustiveActionCheck} from '../traceState';

export function getTraceTabTitle(node: TraceTreeNode<TraceTree.NodeValue>) {
  if (isTransactionNode(node)) {
    return (
      node.value['transaction.op'] +
      (node.value.transaction ? ' - ' + node.value.transaction : '')
    );
  }

  if (isSpanNode(node)) {
    return node.value.op + (node.value.description ? ' - ' + node.value.description : '');
  }

  if (isAutogroupedNode(node)) {
    return t('Autogroup') + ' - ' + node.value.autogrouped_by.op;
  }

  if (isMissingInstrumentationNode(node)) {
    return t('No Instrumentation');
  }

  if (isTraceErrorNode(node)) {
    return node.value.message ?? node.value.title ?? 'Error';
  }

  if (isTraceNode(node)) {
    return t('Trace');
  }

  Sentry.captureMessage('Unknown node type in trace drawer');
  return 'Unknown';
}

type Tab = {
  node: TraceTreeNode<TraceTree.NodeValue> | 'trace' | 'profiles' | 'vitals';
  label?: string;
};

export type TraceTabsReducerState = {
  current_tab: Tab | null;
  last_clicked_tab: Tab | null;
  tabs: Tab[];
};

export type TraceTabsReducerAction =
  | {payload: TraceTabsReducerState; type: 'initialize tabs reducer'}
  | {
      payload: Tab['node'] | number;
      type: 'activate tab';
      pin_previous?: boolean;
    }
  | {type: 'pin tab'}
  | {payload: number; type: 'unpin tab'}
  | {type: 'clear clicked tab'};

export function traceTabsReducer(
  state: TraceTabsReducerState,
  action: TraceTabsReducerAction
): TraceTabsReducerState {
  switch (action.type) {
    case 'initialize tabs reducer': {
      return action.payload;
    }
    case 'activate tab': {
      // If an index was passed, activate the tab at that index
      if (typeof action.payload === 'number') {
        return {
          ...state,
          current_tab: state.tabs[action.payload] ?? state.last_clicked_tab,
        };
      }

      // check if the tab is already pinned somewhere and activate it
      // this prevents duplicate tabs from being created, but that
      // doesnt seem like a usable feature anyways
      for (const tab of state.tabs) {
        if (tab.node === action.payload) {
          return {
            ...state,
            current_tab: tab,
            last_clicked_tab: state.last_clicked_tab,
          };
        }
      }

      const tab = {node: action.payload};

      // If its pinned, activate it and pin the previous tab
      if (action.pin_previous && state.last_clicked_tab) {
        if (state.last_clicked_tab.node === action.payload) {
          return {
            ...state,
            current_tab: state.last_clicked_tab,
            last_clicked_tab: null,
            tabs: [...state.tabs, state.last_clicked_tab],
          };
        }
        return {
          ...state,
          current_tab: tab,
          last_clicked_tab: tab,
          tabs: [...state.tabs, state.last_clicked_tab],
        };
      }

      return {
        ...state,
        current_tab: tab,
        last_clicked_tab: tab,
      };
    }

    case 'pin tab': {
      return {
        ...state,
        current_tab: state.last_clicked_tab,
        last_clicked_tab: null,
        tabs: [...state.tabs, state.last_clicked_tab!],
      };
    }

    case 'unpin tab': {
      const newTabs = state.tabs.filter((_tab, index) => {
        return index !== action.payload;
      });

      const nextTabIsPersistent = typeof newTabs[newTabs.length - 1]!.node === 'string';
      if (nextTabIsPersistent) {
        if (!state.last_clicked_tab && !state.current_tab) {
          throw new Error(
            'last_clicked and current should not be null when nextTabIsPersistent is true'
          );
        }

        const nextTab = nextTabIsPersistent
          ? state.last_clicked_tab ?? state.current_tab
          : newTabs[newTabs.length - 1]!;

        return {
          ...state,
          current_tab: nextTab,
          last_clicked_tab: nextTab,
          tabs: newTabs,
        };
      }

      if (state.current_tab?.node === state.tabs[action.payload]!.node) {
        return {
          ...state,
          current_tab: newTabs[newTabs.length - 1]!,
          last_clicked_tab: state.last_clicked_tab,
          tabs: newTabs,
        };
      }

      const next = state.last_clicked_tab ?? newTabs[newTabs.length - 1]!;

      return {
        ...state,
        current_tab: next,
        last_clicked_tab: next,
        tabs: newTabs,
      };
    }

    case 'clear clicked tab': {
      const next =
        state.last_clicked_tab === state.current_tab
          ? state.tabs[state.tabs.length - 1]!
          : state.current_tab!;
      return {
        ...state,
        current_tab: next,
        last_clicked_tab: null,
      };
    }

    default: {
      traceReducerExhaustiveActionCheck(action);
      return state;
    }
  }
}
