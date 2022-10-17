import {useEffect, useRef, useState} from 'react';
import {Store} from 'reflux';

import {CommonStoreDefinition} from './types';

interface LegacyStoreShape extends Store, CommonStoreDefinition<any> {}

/**
 * This wrapper exists because we have many old-style enzyme tests that trigger
 * updates to stores without being wrapped in act.
 *
 * Wrting tests with React Testing Library typically circumvents the need for
 * this. See [0].
 *
 * [0]: https://javascript.plainenglish.io/you-probably-dont-need-act-in-your-react-tests-2a0bcd2ad65c
 */
window._legacyStoreHookUpdate = update => update();

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
  const callback = () => window._legacyStoreHookUpdate(() => setState(store.getState()));

  // If we setup the listener in useEffect, there is a small race condition
  // where the store may emit an event before we're listening (since useEffect
  // fires AFTER rendering). Avoid this by ensuring we start listening
  // *immediately* after we initialize the useState.
  const unlisten = useRef<Function>();
  if (unlisten.current === undefined) {
    unlisten.current = store.listen(callback, undefined);
  }

  useEffect(() => {
    return () => void unlisten.current?.();
  }, []);

  return state;
}
