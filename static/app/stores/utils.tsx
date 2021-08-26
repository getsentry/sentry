import {useEffect, useState} from 'react';
import Reflux from 'reflux';

type LegacyStoreShape = Reflux.Store & {
  // Store must have `get` function that returns the current state
  get: () => any;
};

/**
 * Returns the state of a reflux store. Automatically unsubscribes when destroyed
 *
 * ```ts
 * const teams = useLegacyStore(TeamStore);
 * ```
 */
export function useLegacyStore<T extends LegacyStoreShape>(
  store: T
): ReturnType<T['get']> {
  const [state, setState] = useState(store.get());
  useEffect(() => store.listen(setState, undefined) as () => void);

  return state;
}
