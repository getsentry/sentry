import {createContext} from 'react';

import type {useOverlay} from '@sentry/scraps/useOverlay';

import type {useSafetyTriangle} from './useSafetyTriangle';

export type OverlayState = ReturnType<typeof useOverlay>['state'];

interface DropdownMenuContextValue {
  /**
   * Closes the submenu that this menu is rendered in. Stable across renders, so
   * focus changes in a menu do not re-render every item through this context.
   */
  closeSubmenu?: () => void;
  /**
   * Overlay state manager (from useOverlay) for the root (top-most) menu. To be used to
   * close the entire menu system.
   */
  rootOverlayState?: OverlayState;
  safetyTriangle?: ReturnType<typeof useSafetyTriangle>;
}

export const DropdownMenuContext = createContext<DropdownMenuContextValue>({});
