import type {Reducer, ReducerAction} from 'react';
import {useReducer} from 'react';

type ReducersObject<S = any, A = any> = {
  [K in keyof S]: Reducer<S, A>;
};

type ReducersState<M> = M extends ReducersObject
  ? {
      [P in keyof M]: M[P] extends Reducer<infer S, any> ? S : never;
    }
  : never;

type ReducerFromReducersObject<M> = M extends {
  [P in keyof M]: infer R;
}
  ? R extends Reducer<any, any>
    ? R
    : never
  : never;

type ReducerActions<M> = M extends ReducersObject
  ? ReducerAction<ReducerFromReducersObject<M>>
  : never;

type CombinedState<S> = {} & S;
export type CombinedReducer<M extends ReducersObject> = Reducer<
  CombinedState<ReducersState<M>>,
  ReducerActions<M>
>;

export function makeCombinedReducers<M extends ReducersObject>(
  reducers: M
): CombinedReducer<M> {
  const keys: Array<keyof M> = Object.keys(reducers);

  return (state, action) => {
    const nextState = {} as ReducersState<M>;

    for (const key of keys) {
      nextState[key] = reducers[key]!(state[key], action);
    }

    return nextState;
  };
}

export function useCombinedReducer<M extends ReducersObject>(
  reducers: M,
  initialState: CombinedState<ReducersState<M>>
): [CombinedState<ReducersState<M>>, React.Dispatch<ReducerActions<M>>] {
  return useReducer(makeCombinedReducers(reducers), initialState);
}
