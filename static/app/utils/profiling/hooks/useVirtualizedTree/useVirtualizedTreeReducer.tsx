export interface VirtualizedState<T> {
  overscroll: number;
  roots: T[];
  scrollHeight: number;
  scrollTop: number;
  selectedNodeIndex: number | null;
}

interface SetScrollTop {
  payload: number;
  type: 'set scroll top';
}

interface SetSelectedNodeIndex {
  payload: number | null;
  type: 'set selected node index';
}
interface SetContainerHeight {
  payload: number;
  type: 'set scroll height';
}

interface ScrollToIndex {
  payload: {scrollTop: number; selectedNodeIndex: number};
  type: 'scroll to index';
}

type VirtualizedStateAction =
  | SetScrollTop
  | SetContainerHeight
  | SetSelectedNodeIndex
  | ScrollToIndex;

export function VirtualizedTreeReducer<T>(
  state: VirtualizedState<T>,
  action: VirtualizedStateAction
): VirtualizedState<T> {
  switch (action.type) {
    case 'scroll to index': {
      return {...state, ...action.payload};
    }
    case 'set selected node index': {
      return {...state, selectedNodeIndex: action.payload};
    }
    case 'set scroll top': {
      return {...state, scrollTop: action.payload};
    }
    case 'set scroll height': {
      return {...state, scrollHeight: action.payload};
    }
    default: {
      return state;
    }
  }
}
