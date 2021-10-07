import {useEffect, useState} from 'react';
import Reflux from 'reflux';

import {CommonStoreInterface} from './types';

type LegacyStoreShape = Reflux.Store & CommonStoreInterface<any>;

/**
 * Returns the state of a reflux store. Automatically unsubscribes when destroyed
 *
 * ```
 * const teams = useLegacyStore(TeamStore);
 * ```
 */
export function useLegacyStore<T extends LegacyStoreShape>(
  store: T
): ReturnType<T['getState']> {
  const [state, setState] = useState(store.getState());

  // Not all stores emit the new state, call get on change
  const callback = () => setState(store.getState());

  useEffect(() => store.listen(callback, undefined) as () => void, []);

  return state;
}
