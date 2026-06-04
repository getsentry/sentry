import {useCallback, useSyncExternalStore} from 'react';
import type {Store} from 'reflux';

interface LegacyStoreShape extends Pick<Store, 'listen'> {
  getState(): any;
}

/**
 * Returns the state of a reflux store. Automatically unsubscribes when destroyed
 *
 * ```tsx
 * const teams = useLegacyStore(TeamStore);
 * ```
 *
 * @link https://react.dev/reference/react/useSyncExternalStore
 */
export function useLegacyStore<T extends LegacyStoreShape>(
  store: T
): ReturnType<T['getState']> {
  const listener = useCallback(
    (fn: () => void) => {
      // Pass undefined to 2nd listen argument otherwise it explodes
      return store.listen(fn, undefined) as () => void;
    },
    [store]
  );

  return useSyncExternalStore(listener, store.getState);
}
