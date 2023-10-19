import {ReducerAction, ReducerState, useMemo, useReducer} from 'react';

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

export type UndoableReducerAction<A> = UndoAction | RedoAction | A;

export type UndoableReducer<R extends React.Reducer<any, any>> = React.Reducer<
  UndoableNode<ReducerState<R>>,
  UndoableReducerAction<ReducerAction<R>>
>;

function isUndoOrRedoAction(
  action: UndoableReducerAction<any>
): action is UndoAction | RedoAction {
  if (action.type) {
    return action.type === 'undo' || action.type === 'redo';
  }
  return false;
}

function undoableReducer<S>(
  state: UndoableNode<S>,
  action: UndoAction | RedoAction
): UndoableNode<S> {
  if (action.type === 'undo') {
    return state.previous === undefined ? state : state.previous;
  }

  if (action.type === 'redo') {
    return state.next === undefined ? state : state.next;
  }

  throw new Error('Unreachable case');
}

export function makeUndoableReducer<R extends React.Reducer<any, any>>(
  reducer: R
): UndoableReducer<R> {
  return (
    state: UndoableNode<ReducerState<R>>,
    action: UndoableReducerAction<ReducerAction<R>>
  ) => {
    if (isUndoOrRedoAction(action)) {
      return undoableReducer(state, action);
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

type UndoableReducerState<R extends React.Reducer<ReducerState<R>, ReducerAction<R>>> = [
  ReducerState<R>,
  React.Dispatch<UndoableReducerAction<ReducerAction<R>>>,
  {
    nextState: ReducerState<R> | undefined;
    previousState: ReducerState<R> | undefined;
  },
];

export function useUndoableReducer<
  R extends React.Reducer<ReducerState<R>, ReducerAction<R>>,
>(reducer: R, initialState: ReducerState<R>): UndoableReducerState<R> {
  const [state, dispatch] = useReducer(makeUndoableReducer(reducer), {
    current: initialState,
    previous: undefined,
    next: undefined,
  });

  const value: UndoableReducerState<R> = useMemo(() => {
    return [
      state.current,
      dispatch,
      {previousState: state.previous?.current, nextState: state.next?.current},
    ];
  }, [state, dispatch]);

  return value;
}
