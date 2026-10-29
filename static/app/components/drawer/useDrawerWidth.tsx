import {clampDrawerWidth, DEFAULT_WIDTH_PERCENT} from '@sentry/scraps/drawer';

import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
function getDrawerWidthKey(drawerKey: string) {
  return 'drawer-width:' + drawerKey;
}
export function useDrawerWidth({
  drawerKey,
  drawerWidth,
}: {
  drawerKey?: string;
  drawerWidth?: string;
}) {
  // Calculate initial width from props or use default
  const calculateInitialWidth = (savedWidth?: number) => {
    // If we have a saved width, use it but ensure it's within bounds
    if (savedWidth !== undefined) {
      return clampDrawerWidth(savedWidth);
    }

    if (drawerWidth) {
      // If width is already in percentage, parse and clamp it
      if (drawerWidth.endsWith('%')) {
        const parsedPercent = parseFloat(drawerWidth);
        return clampDrawerWidth(parsedPercent);
      }
      // If width is in pixels, convert to percentage and clamp
      const viewportWidth = window.innerWidth;
      const parsedPixels = parseFloat(drawerWidth);
      const percentValue = (parsedPixels / viewportWidth) * 100;
      return clampDrawerWidth(percentValue);
    }

    return DEFAULT_WIDTH_PERCENT;
  };

  // Store persisted width in localStorage, but don't use it for rendering state
  const [persistedWidthPercent, setPersistedWidthPercent] =
    useSyncedLocalStorageState<number>(
      drawerKey ? getDrawerWidthKey(drawerKey) : 'drawer-width:default',
      (value?: unknown) => {
        const savedWidth = typeof value === 'number' ? value : undefined;
        return calculateInitialWidth(savedWidth);
      }
    );

  return [persistedWidthPercent, setPersistedWidthPercent] as const;
}
