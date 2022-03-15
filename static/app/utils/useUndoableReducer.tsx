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

type UndoableReducerAction<A> = UndoAction | RedoAction | A;

function isUndoOrRedoAction(
  action: UndoableReducerAction<any>
): action is UndoAction | RedoAction {
  if (action.type) {
    return action.type === 'undo' || action.type === 'redo';
  }
  return false;
}

function undoableReducer<S, A>(
  state: UndoableNode<S>,
  action: UndoableReducerAction<A>
): UndoableNode<S> {
  if (!isUndoOrRedoAction(action)) {
    return state;
  }

  if (action.type === 'undo') {
    return state.previous ? state.previous : state;
  }

  if (action.type === 'redo') {
    return state.next ? state.next : state;
  }

  throw new Error('Unreachable case');
}

type CombinedReducer<R extends React.Reducer<any, any>> = React.Reducer<
  UndoableNode<ReducerState<R>>,
  UndoableReducerAction<ReducerAction<R>>
>;

export function makeUndoableReducer<R extends React.Reducer<any, any>>(
  reducer: R
): CombinedReducer<R> {
  return (
    state: UndoableNode<ReducerState<R>>,
    action: UndoableReducerAction<ReducerAction<R>>
  ) => {
    const maybeUndoOrRedo = undoableReducer(state, action);

    if (maybeUndoOrRedo !== state) {
      return maybeUndoOrRedo;
    }

    const newState = reducer(state.current, action);

    return {
      next: undefined,
      current: newState,
      previous: state,
    };
  };
}

export function useUndoableReducer<
  R extends React.Reducer<ReducerState<R>, ReducerAction<R>>
>(
  reducer: R,
  initialState: ReducerState<R>
): [ReducerState<R>, React.Dispatch<UndoableReducerAction<ReducerAction<R>>>] {
  const [state, dispatch] = useReducer(makeUndoableReducer(reducer), {
    current: initialState,
    previous: undefined,
    next: undefined,
  });

  return [state.current, dispatch];
}
