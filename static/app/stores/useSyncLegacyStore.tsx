import {useSyncExternalStore} from 'react';

import type {LegacyStoreShape} from './useLegacyStore';

/**
 * A more efficent version of `useLegacyStore` that uses `useSyncExternalStore`
 * Caveats:
 * - getState must keep a reference to the same object if the state hasn't changed
 */
export function useSyncLegacyStore<T extends LegacyStoreShape>(
  store: T
): ReturnType<T['getState']> {
  // https://react.dev/reference/react/useSyncExternalStore
  const state = useSyncExternalStore(
    // Pass undefined to 2nd listen argument using bind
    store.listen.bind(store, undefined, undefined) as () => () => void,
    store.getState
  );
  return state;
}
