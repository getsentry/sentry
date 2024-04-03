import {useCallback, useMemo, useRef, useState} from 'react';

/**
 * A hook that wraps a reducer to provide an observer pattern for the state.
 * By observing the state, we can avoid reacting to it via effects
 *
 * @param reducer The reducer function that updates the state.
 * @param initialState The initial state of the reducer.
 * @param initializer An optional function that can be used to initialize the state.
 */

type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any ? A : never;
interface Middlewares<S, A> {
  ['before action']: (S: Readonly<S>, A: A) => void;
  ['before next state']: (P: Readonly<S>, S: Readonly<S>, A: A) => void;
}

type MiddlewaresEvent<S, A> = {[K in keyof Middlewares<S, A>]: Set<Middlewares<S, A>[K]>};

class Emitter<S, A> {
  listeners: MiddlewaresEvent<S, A> = {
    'before action': new Set<Middlewares<S, A>['before action']>(),
    'before next state': new Set<Middlewares<S, A>['before next state']>(),
  };

  on(key: keyof Middlewares<S, A>, fn: Middlewares<S, A>[keyof Middlewares<S, A>]) {
    const store = this.listeners[key];
    if (!store) {
      throw new Error(`Unsupported reducer middleware: ${key}`);
    }

    // @ts-expect-error we cant actually validate function types here
    store.add(fn);
  }

  removeListener(
    key: keyof Middlewares<S, A>,
    listener: Middlewares<S, A>[keyof Middlewares<S, A>]
  ) {
    const store = this.listeners[key];
    if (!store) {
      throw new Error(`Unsupported reducer middleware: ${key}`);
    }

    // @ts-expect-error we cant actually validate function types here
    store.delete(listener);
  }

  emit(
    key: keyof Middlewares<S, A>,
    ...args: ArgumentTypes<Middlewares<S, A>[typeof key]>
  ) {
    const store = this.listeners[key];
    if (!store) {
      throw new Error(`Unsupported reducer middleware: ${key}`);
    }

    store.forEach(fn => fn(...args));
  }
}

export function useDispatchingReducer<S, A>(
  reducer: React.Reducer<S, A>,
  initialState: S,
  initializer?: (arg: S) => S
): [S, React.Dispatch<A>, Emitter<S, A>] {
  const emitter = useMemo(() => new Emitter<S, A>(), []);
  const [state, setState] = useState(initialState ?? (initializer?.(initialState) as S));

  const reducerRef = useRef(reducer);
  reducerRef.current = reducer;

  // Store state reference in ref so that the callback can be stable
  const stateRef = useRef(state);
  stateRef.current = state;

  const wrappedDispatch = useCallback(
    (action: A) => {
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
