import {clampDrawerWidth, getDrawerWidthPercent} from '@sentry/scraps/drawer';

import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

export function useDrawerWidth({
  drawerKey,
  drawerWidth,
}: {
  drawerKey?: string;
  drawerWidth?: string;
}) {
  return useSyncedLocalStorageState<number>(
    drawerKey ? `drawer-width:${drawerKey}` : 'drawer-width:default',
    (value?: unknown) =>
      typeof value === 'number'
        ? clampDrawerWidth(value)
        : getDrawerWidthPercent(drawerWidth)
  );
}
