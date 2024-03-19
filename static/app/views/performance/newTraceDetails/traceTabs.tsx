import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceTree';

type Tab = {
  node: TraceTreeNode<TraceTree.NodeValue> | 'Trace';
};

export type TraceTabsReducerState = {
  current: Tab | null;
  last_clicked: Tab | null;
  tabs: Tab[];
};

export type TraceTabsReducerAction =
  | {
      payload: TraceTreeNode<TraceTree.NodeValue> | number;
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
    case 'activate tab': {
      // If an index was passed, activate the tab at that index
      if (typeof action.payload === 'number') {
        return {
          ...state,
          current: state.tabs[action.payload] ?? state.last_clicked,
        };
      }

      // check if the tab is already pinned somewhere and activate it
      // this prevents duplicate tabs from being created, but that
      // doesnt seem like a usable feature anyways
      for (const tab of state.tabs) {
        if (tab.node === action.payload) {
          return {
            ...state,
            current: tab,
            last_clicked: state.last_clicked,
          };
        }
      }

      const tab = {node: action.payload};

      // If its pinned, activate it and pin the previous tab
      if (action.pin_previous && state.last_clicked) {
        if (state.last_clicked.node === action.payload) {
          return {
            ...state,
            current: state.last_clicked,
            last_clicked: null,
            tabs: [...state.tabs, state.last_clicked],
          };
        }
        return {
          ...state,
          current: tab,
          last_clicked: tab,
          tabs: [...state.tabs, state.last_clicked],
        };
      }
      // If it's not pinned, create a new tab and activate it
      return {
        ...state,
        current: tab,
        last_clicked: tab,
      };
    }

    case 'pin tab': {
      return {
        ...state,
        current: state.last_clicked,
        last_clicked: null,
        tabs: [...state.tabs, state.last_clicked!],
      };
    }

    case 'unpin tab': {
      const newTabs = state.tabs.filter((_tab, index) => {
        return index !== action.payload;
      });

      const nextTabIsPersistent = typeof newTabs[newTabs.length - 1].node === 'string';
      if (nextTabIsPersistent) {
        if (!state.last_clicked && !state.current) {
          throw new Error(
            'last_clicked and current should not be null when nextTabIsPersistent is true'
          );
        }
        const nextTab = nextTabIsPersistent
          ? state.last_clicked ?? state.current
          : newTabs[newTabs.length - 1];

        return {
          ...state,
          current: nextTab,
          last_clicked: nextTab,
          tabs: newTabs,
        };
      }

      const next = state.last_clicked ?? newTabs[newTabs.length - 1];

      return {
        ...state,
        current: next,
        last_clicked: next,
        tabs: newTabs,
      };
    }

    default: {
      throw new Error('Invalid action');
    }
  }
}
