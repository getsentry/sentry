import {ReducerAction, ReducerState, useReducer} from 'react';

export type UndoableNode<S> = {
  current: S;
  next: UndoableNode<S> | undefined;
  previous: UndoableNode<S> | undefined;
};

type UndoAction = {
  type: 'undo';
};

type RedoAction = {
  type: 'redo';
};

type ResetAction = {
  type: 'reset';
};

type BaseUndoableReducerAction = UndoAction | RedoAction | ResetAction;

export type UndoableReducerAction<A> = BaseUndoableReducerAction | A;

export type UndoableReducer<R extends React.Reducer<any, any>> = React.Reducer<
  UndoableNode<ReducerState<R>>,
  UndoableReducerAction<ReducerAction<R>>
>;

function isUndoOrRedoAction(
  action: UndoableReducerAction<any>
): action is BaseUndoableReducerAction {
  if (action.type) {
    return action.type === 'undo' || action.type === 'redo' || action.type === 'reset';
  }
  return false;
}

function undoableReducer<S, R extends React.Reducer<any, any>>(
  state: UndoableNode<S>,
  action: BaseUndoableReducerAction,
  initialState: ReducerState<R>
): UndoableNode<S> {
  if (action.type === 'undo') {
    return state.previous === undefined ? state : state.previous;
  }

  if (action.type === 'redo') {
    return state.next === undefined ? state : state.next;
  }

  if (action.type === 'reset') {
    return {
      current: initialState,
      previous: undefined,
      next: undefined,
    };
  }

  throw new Error('Unreachable case');
}

export function makeUndoableReducer<R extends React.Reducer<any, any>>(
  reducer: R,
  initialState: ReducerState<R>
): UndoableReducer<R> {
  return (
    state: UndoableNode<ReducerState<R>>,
    action: UndoableReducerAction<ReducerAction<R>>
  ) => {
    if (isUndoOrRedoAction(action)) {
      return undoableReducer(state, action, initialState);
    }

    const newState: UndoableNode<ReducerState<R>> = {
      next: undefined,
      previous: state,
      current: reducer(state.current, action),
    };

    state.next = newState;
    return newState;
  };
}

export function useUndoableReducer<
  R extends React.Reducer<ReducerState<R>, ReducerAction<R>>
>(
  reducer: R,
  initialState: ReducerState<R>
): [ReducerState<R>, React.Dispatch<UndoableReducerAction<ReducerAction<R>>>] {
  const [state, dispatch] = useReducer(makeUndoableReducer(reducer, {...initialState}), {
    current: {...initialState},
    previous: undefined,
    next: undefined,
  });

  return [state.current, dispatch];
}
