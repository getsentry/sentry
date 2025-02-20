import {createContext, useContext, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/components/nav/constants';
import {NavLayout, type PrimaryNavGroup} from 'sentry/components/nav/types';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMedia from 'sentry/utils/useMedia';

export interface NavContext {
  activeGroup: PrimaryNavGroup | null;
  isCollapsed: boolean;
  isDragging: boolean;
  layout: NavLayout;
  secondaryNavEl: HTMLElement | null;
  setActiveGroup: (group: PrimaryNavGroup | null) => void;
  setIsCollapsed: (isCollapsed: boolean) => void;
  setIsDragging: (isDragging: boolean) => void;
  setSecondaryNavEl: (el: HTMLElement | null) => void;
}

const NavContext = createContext<NavContext>({
  secondaryNavEl: null,
  setSecondaryNavEl: () => {},
  layout: NavLayout.SIDEBAR,
  isCollapsed: false,
  setIsCollapsed: () => {},
  activeGroup: null,
  setActiveGroup: () => {},
  isDragging: false,
  setIsDragging: () => {},
});

export function useNavContext(): NavContext {
  return useContext(NavContext);
}

export function NavContextProvider({children}: {children: React.ReactNode}) {
  const [isCollapsed, setIsCollapsed] = useLocalStorageState(
    NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
    false
  );
  const [secondaryNavEl, setSecondaryNavEl] = useState<HTMLElement | null>(null);
  const [activeGroup, setActiveGroup] = useState<PrimaryNavGroup | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const theme = useTheme();
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.medium})`);

  const value = useMemo(
    () => ({
      secondaryNavEl,
      setSecondaryNavEl,
      layout: isMobile ? NavLayout.MOBILE : NavLayout.SIDEBAR,
      isCollapsed,
      setIsCollapsed,
      activeGroup,
      setActiveGroup,
      isDragging,
      setIsDragging,
    }),
    [
      secondaryNavEl,
      isMobile,
      isCollapsed,
      setIsCollapsed,
      activeGroup,
      isDragging,
      setIsDragging,
    ]
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}
