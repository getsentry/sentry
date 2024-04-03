import type React from 'react';
import {
  type ReducerAction,
  type ReducerState,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * A hook that wraps a reducer to provide an observer pattern for the state.
 * By observing the state, we can avoid reacting to it via effects
 *
 * @param reducer The reducer function that updates the state.
 * @param initialState The initial state of the reducer.
 * @param initializer An optional function that can be used to initialize the state.
 */

type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any ? A : never;
export interface DispatchingReducerMiddleware<R extends React.Reducer<any, any>> {
  ['before action']: (S: Readonly<ReducerState<R>>, A: React.ReducerAction<R>) => void;
  ['before next state']: (
    P: Readonly<React.ReducerState<R>>,
    S: Readonly<React.ReducerState<R>>,
    A: React.ReducerAction<R>
  ) => void;
}

type MiddlewaresEvent<R extends React.Reducer<any, any>> = {
  [K in keyof DispatchingReducerMiddleware<R>]: Set<DispatchingReducerMiddleware<R>[K]>;
};

class Emitter<R extends React.Reducer<any, any>> {
  listeners: MiddlewaresEvent<R> = {
    'before action': new Set<DispatchingReducerMiddleware<R>['before action']>(),
    'before next state': new Set<DispatchingReducerMiddleware<R>['before next state']>(),
  };

  on(
    key: keyof DispatchingReducerMiddleware<R>,
    fn: DispatchingReducerMiddleware<R>[keyof DispatchingReducerMiddleware<R>]
  ) {
    const store = this.listeners[key];
    if (!store) {
      throw new Error(`Unsupported reducer middleware: ${key}`);
    }

    // @ts-expect-error we cant actually validate function types here
    store.add(fn);
  }

  off(
    key: keyof DispatchingReducerMiddleware<R>,
    listener: DispatchingReducerMiddleware<R>[keyof DispatchingReducerMiddleware<R>]
  ) {
    const store = this.listeners[key];
    if (!store) {
      throw new Error(`Unsupported reducer middleware: ${key}`);
    }

    // @ts-expect-error we cant actually validate function types here
    store.delete(listener);
  }

  emit(
    key: keyof DispatchingReducerMiddleware<R>,
    ...args: ArgumentTypes<DispatchingReducerMiddleware<R>[typeof key]>
  ) {
    const store = this.listeners[key];
    if (!store) {
      throw new Error(`Unsupported reducer middleware: ${key}`);
    }

    store.forEach(fn => fn(...args));
  }
}

export function useDispatchingReducer<R extends React.Reducer<any, any>>(
  reducer: R,
  initialState: ReducerState<R>,
  initializer?: (arg: ReducerState<R>) => ReducerState<R>
): [ReducerState<R>, React.Dispatch<ReducerAction<R>>, Emitter<R>] {
  const emitter = useMemo(() => new Emitter<R>(), []);
  const [state, setState] = useState(
    initialState ?? (initializer?.(initialState) as ReducerState<R>)
  );

  const reducerRef = useRef(reducer);
  reducerRef.current = reducer;

  // Store state reference in ref so that the callback can be stable
  const stateRef = useRef(state);
  stateRef.current = state;

  const wrappedDispatch = useCallback(
    (action: ReducerAction<R>) => {
      // @TODO it is possible for a dispatched action to throw an error
      // and break the reducer. We should probably catch it, I'm just not sure
      // what would be the best mechanism to handle it. If we opt to rethrow,
      // we are likely going to have to rethrow async and lose stack traces...
      emitter.emit('before action', stateRef.current, action);
      const nextState = reducerRef.current(stateRef.current, action);
      emitter.emit('before next state', stateRef.current, nextState, action);
      setState(nextState);
    },
    [emitter]
  );

  return [state, wrappedDispatch, emitter];
}
