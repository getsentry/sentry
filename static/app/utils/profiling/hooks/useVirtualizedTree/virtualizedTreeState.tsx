interface VirtualizedState<T> {
  overscroll: number;
  roots: T[];
  scrollHeight: number;
  scrollTop: number;
}

interface SetScrollTop {
  payload: number;
  type: 'set scroll top';
}

interface SetContainerHeight {
  payload: number;
  type: 'set scroll height';
}

type VirtualizedStateAction = SetScrollTop | SetContainerHeight;

export function VirtualizedTreeStateReducer<T>(
  state: VirtualizedState<T>,
  action: VirtualizedStateAction
): VirtualizedState<T> {
  switch (action.type) {
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
