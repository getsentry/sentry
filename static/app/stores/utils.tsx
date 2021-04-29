import {useEffect, useState} from 'react';
import Reflux from 'reflux';

type LegacyStoreShape = Reflux.Store & {
  // Store must have `get` function that returns the current state
  get: () => any;
};

export function useLegacyStore<T extends LegacyStoreShape>(
  store: T
): ReturnType<T['get']> {
  const [state, setState] = useState(store.get());
  useEffect(() => store.listen(setState, undefined) as () => void);

  return state;
}
