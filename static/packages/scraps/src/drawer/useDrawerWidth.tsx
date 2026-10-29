import {useCallback, useSyncExternalStore} from 'react';

import {useOverlayContext} from '@sentry/scraps/overlayContext';

import {clampDrawerWidth, getDrawerWidthPercent} from './useDrawerResizing';

export function useDrawerWidth({
  drawerKey = 'default',
  drawerWidth,
}: {
  drawerKey?: string;
  drawerWidth?: string;
}) {
  const {drawer} = useOverlayContext();
  const storage = drawer?.widthStorage;
  const subscribe = useCallback(
    (listener: () => void) => storage?.subscribe(drawerKey, listener) ?? (() => {}),
    [storage, drawerKey]
  );
  const getSnapshot = useCallback(() => storage?.get(drawerKey), [storage, drawerKey]);
  const savedWidth = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const onWidthChange = useCallback(
    (widthPercent: number) => storage?.set(drawerKey, widthPercent),
    [storage, drawerKey]
  );

  return {
    widthPercent:
      savedWidth === undefined
        ? getDrawerWidthPercent(drawerWidth)
        : clampDrawerWidth(savedWidth),
    onWidthChange,
  };
}
