import {createContext, useContext} from 'react';

import type {useOverlay} from 'sentry/utils/useOverlay';

export interface MenuContextValue {
  close: () => void;
  isOpen: boolean;
  listRef: React.RefObject<HTMLUListElement | null>;
  open: () => void;
  overlayProps: ReturnType<typeof useOverlay>['overlayProps'];
  search: string;
  searchRef: React.RefObject<HTMLInputElement | null>;
  setSearch: (search: string) => void;
  triggerProps: ReturnType<typeof useOverlay>['triggerProps'];
  goBack?: () => void;
}

export const MenuContext = createContext<MenuContextValue | null>(null);

export function useMenuContext() {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('Menu components must be used inside Menu');
  }
  return context;
}
