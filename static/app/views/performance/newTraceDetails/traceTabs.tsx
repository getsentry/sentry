import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceTree';

type Tab = {
  active: boolean;
  node: TraceTreeNode<TraceTree.NodeValue>;
  removable: boolean;
};

export type TraceTabsReducerState = {
  tabs: Tab[];
};

export type TraceTabsReducerAction =
  | {payload: TraceTabsReducerState; type: 'initialize'}
  | {payload: TraceTreeNode<TraceTree.NodeValue>; type: 'set active tab'}
  | {payload: number; type: 'close tab'}
  | {payload: number; type: 'close all tabs'};

export function traceTabsReducer(
  state: TraceTabsReducerState,
  action: TraceTabsReducerAction
): TraceTabsReducerState {
  switch (action.type) {
    case 'set active tab': {
      let foundExistingTab = false;

      for (let i = 0; i < state.tabs.length; i++) {
        if (state.tabs[i].node === action.payload) {
          state.tabs[i].active = true;
          foundExistingTab = true;
        } else {
          state.tabs[i].active = false;
        }
      }

      if (!foundExistingTab) {
        state.tabs.pop();
        return {
          ...state,
          tabs: [...state.tabs, {active: true, node: action.payload, removable: true}],
        };
      }

      return {
        ...state,
        tabs: [...state.tabs],
      };
    }

    case 'close tab': {
      const newTabs = state.tabs.filter((_tab, index) => {
        return index !== action.payload;
      });
      return {
        ...state,
        tabs: newTabs,
      };
    }

    default: {
      throw new Error('Invalid action');
    }
  }
}
