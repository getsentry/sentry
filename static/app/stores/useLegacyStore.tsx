import {useEffect, useState} from 'react';
import Reflux from 'reflux';

type LegacyStoreShape = Reflux.Store & {
  // Store must have `get` function that returns the current state
  get: () => any;
};

/**
 * Returns the state of a reflux store. Automatically unsubscribes when destroyed
 *
 * ```
 * const teams = useLegacyStore(TeamStore);
 * ```
 */
export function useLegacyStore<T extends LegacyStoreShape>(
  store: T
): ReturnType<T['get']> {
  const [state, setState] = useState(store.get());
  // Not all stores emit the new state, call get on change
  const callback = () => setState(store.get());
  useEffect(() => store.listen(callback, undefined) as () => void, []);

  return state;
}
