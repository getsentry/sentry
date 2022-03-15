import {useReducer} from 'react';

type Reducer<S = any, A = any> = (state: S, action: A) => S;
type ReducerActions<R> = R extends Reducer<any, infer A> ? A : never;

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

type AllReducerAction<M> = M extends ReducersObject
  ? ReducerActions<ReducerFromReducersObject<M>>
  : never;

type CombinedState<S> = {} & S;
type CombinedReducer<M extends ReducersObject> = Reducer<
  CombinedState<ReducersState<M>>,
  AllReducerAction<M>
>;

export function combineReducers<M extends ReducersObject>(
  reducers: M
): CombinedReducer<M> {
  const keys = Object.keys(reducers);

  return (state, action) => {
    for (const key of keys) {
      state[key as keyof M] = reducers[key](state[key], action);
    }
    return state;
  };
}

export function useCombinedReducer<M extends ReducersObject>(
  reducers: M,
  initialState: CombinedState<ReducersState<M>>
): [CombinedState<ReducersState<M>>, React.Dispatch<AllReducerAction<M>>] {
  return useReducer(combineReducers(reducers), initialState);
}
