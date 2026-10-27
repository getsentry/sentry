import {Store} from '@tanstack/react-store';

/**
 * Wraps a TanStack Store with the `getState`/`subscribe` shape our stores
 * expose, and lets callers replace the state without notifying subscribers.
 *
 * Reflux stores reset their state silently, and many callers (mostly tests
 * resetting stores in `afterEach` while components are still mounted) rely on
 * that. Use `resetState` for those writes and `setState` for everything else.
 */
export function createLegacyStore<T>(initialState: T) {
  const store = new Store<T>(initialState);
  let silent = false;

  const source = {
    get: () => store.state,
    subscribe: (listener: (state: T) => void) =>
      store.subscribe(state => {
        if (!silent) {
          listener(state);
        }
      }),
  };

  return {
    /**
     * Pass to `useSelector` from `@tanstack/react-store`
     */
    source,

    getState: () => store.state,

    setState: (updater: (prev: T) => T) => store.setState(updater),

    /**
     * Returns an unsubscribe function
     */
    subscribe(listener: (state: T) => void) {
      return source.subscribe(listener).unsubscribe;
    },

    /**
     * Replaces the state without notifying subscribers
     */
    resetState(state: T) {
      silent = true;
      try {
        store.setState(() => state);
      } finally {
        silent = false;
      }
    },
  };
}
