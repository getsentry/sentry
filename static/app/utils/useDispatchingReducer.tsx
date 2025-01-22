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

export class DispatchingReducerEmitter<R extends React.Reducer<any, any>> {
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

    // @ts-ignore TS(2345): Argument of type '((S: Readonly<ReducerState<R>>, ... Remove this comment to see the full error message
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

    // @ts-ignore TS(2345): Argument of type '((S: Readonly<ReducerState<R>>, ... Remove this comment to see the full error message
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

    // @ts-ignore TS(2556): A spread argument must either have a tuple type or... Remove this comment to see the full error message
    store.forEach(fn => fn(...args));
  }
}

function update<R extends React.Reducer<any, any>>(
  state: ReducerState<R>,
  actions: ReducerAction<R>[],
  reducer: R,
  emitter: DispatchingReducerEmitter<R>
) {
  if (!actions.length) {
    return state;
  }

  let start = state;
  while (actions.length > 0) {
    const next = actions.shift()!;
    emitter.emit('before action', start, next);
    const nextState = reducer(start, next);
    emitter.emit('before next state', start, nextState, next);
    start = nextState;
  }

  return start;
}

export function useDispatchingReducer<R extends React.Reducer<any, any>>(
  reducer: R,
  initialState: ReducerState<R>,
  initializer?: (arg: ReducerState<R>) => ReducerState<R>
): [ReducerState<R>, React.Dispatch<ReducerAction<R>>, DispatchingReducerEmitter<R>] {
  const emitter = useMemo(() => new DispatchingReducerEmitter<R>(), []);
  const [state, setState] = useState(
    initialState ?? (initializer?.(initialState) as ReducerState<R>)
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  const reducerRef = useRef(reducer);
  reducerRef.current = reducer;

  const actionQueue = useRef<ReducerAction<R>[]>([]);
  const updatesRef = useRef<number | null>(null);

  const wrappedDispatch = useCallback(
    (a: ReducerAction<R>) => {
      // @TODO it is possible for a dispatched action to throw an error
      // and break the reducer. We should probably catch it, I'm just not sure
      // what would be the best mechanism to handle it. If we opt to rethrow,
      // we are likely going to have to rethrow async and lose stack traces...
      actionQueue.current.push(a);

      if (updatesRef.current) {
        window.cancelAnimationFrame(updatesRef.current);
        updatesRef.current = null;
      }

      updatesRef.current = window.requestAnimationFrame(() => {
        setState(s => {
          const next = update(s, actionQueue.current, reducerRef.current, emitter);
          stateRef.current = next;
          return next;
        });
      });
    },
    // Emitter is stable and can be ignored
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return [state, wrappedDispatch, emitter];
}
