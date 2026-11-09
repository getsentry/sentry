import {createContext} from 'react';
import type {TreeState} from '@react-stately/tree';

import type {useOverlay} from '@sentry/scraps/useOverlay';

import type {MenuItemProps} from './item';
import type {useSafetyTriangle} from './useSafetyTriangle';

export type OverlayState = ReturnType<typeof useOverlay>['state'];

interface DropdownMenuContextValue {
  /**
   * Menu state (from @react-aria's useTreeState) of the parent menu. To be used to
   * close the current submenu.
   */
  parentMenuState?: TreeState<MenuItemProps>;
  /**
   * Overlay state manager (from useOverlay) for the root (top-most) menu. To be used to
   * close the entire menu system.
   */
  rootOverlayState?: OverlayState;
  safetyTriangle?: ReturnType<typeof useSafetyTriangle>;
}

export const DropdownMenuContext = createContext<DropdownMenuContextValue>({});
