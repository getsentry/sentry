import {useCallback, useState, useSyncExternalStore} from 'react';

import {useOverlayContext} from '@sentry/scraps/overlayContext';

export function useDrawerWidth(key: string, initialize: (value?: unknown) => number) {
  const {drawer} = useOverlayContext();
  const storage = drawer?.widthStorage;
  const subscribe = useCallback(
    (listener: () => void) => storage?.subscribe(key, listener) ?? (() => {}),
    [storage, key]
  );
  const getSnapshot = useCallback(() => storage?.get(key), [storage, key]);
  const savedWidth = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [state, setState] = useState(() => ({
    key,
    savedWidth,
    value: initialize(savedWidth),
  }));
  const changed = state.key !== key || !Object.is(state.savedWidth, savedWidth);
  const value = changed ? initialize(savedWidth) : state.value;
  if (changed) {
    setState({key, savedWidth, value});
  }
  const setWidth = useCallback(
    (nextWidth: number) => {
      setState(previous => ({...previous, value: nextWidth}));
      storage?.set(key, nextWidth);
    },
    [storage, key]
  );
  return [value, setWidth] as const;
}
