import {createStore} from 'zustand';

/**
 * Creates a Zustand store that can also replace its state without notifying
 * subscribers.
 *
 * Our stores have always reset their state silently, and many callers (mostly tests
 * resetting stores in `afterEach` while components are still mounted) rely on
 * that. Use `resetState` for those writes and `setState` for everything else.
 */
export function createLegacyStore<T>(initialState: () => T) {
  const store = createStore<T>()(initialState);
  let silent = false;

  return {
    ...store,

    subscribe(listener: (state: T, prevState: T) => void) {
      return store.subscribe((state, prevState) => {
        if (!silent) {
          listener(state, prevState);
        }
      });
    },

    /**
     * Replaces the state without notifying subscribers
     */
    resetState(state: T) {
      silent = true;
      try {
        store.setState(state, true);
      } finally {
        silent = false;
      }
    },
  };
}
