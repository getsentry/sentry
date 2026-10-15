import {createContext} from 'react';
import type {TreeState} from '@react-stately/tree';

import type {useSafetyTriangle} from '@sentry/scraps/dropdownMenu/useSafetyTriangle';

import type {useOverlay} from 'sentry/utils/useOverlay';

import type {MenuItemProps} from './item';

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
