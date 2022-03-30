import {useEffect, useState} from 'react';
import isEqual from 'lodash/isEqual';
import {Store} from 'reflux';

import {SafeRefluxStore} from '../utils/makeSafeRefluxStore';

import {CommonStoreInterface} from './types';

type LegacyStoreShape =
  | (Store & CommonStoreInterface<any>)
  | (SafeRefluxStore & CommonStoreInterface<any>);

/**
 * This wrapper exists because we have many old-style enzyme tests that trigger
 * updates to stores without being wrapped in act.
 *
 * Wrting tests with React Testing Library typically circumvents the need for
 * this. See [0].
 *
 * [0]: https://javascript.plainenglish.io/you-probably-dont-need-act-in-your-react-tests-2a0bcd2ad65c
 */
window._legacyStoreHookUpdate = (update, hookState, storeState) =>
  !isEqual(hookState, storeState) ? update() : null;

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
  const callback = () =>
    window._legacyStoreHookUpdate(
      () => setState(store.getState()),
      state,
      store.getState()
    );

  useEffect(() => {
    const listener = store.listen(callback, undefined);

    return () => {
      listener();
    };
  }, []);

  return state;
}
