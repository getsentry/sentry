import {createContext, useContext, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/components/nav/constants';
import {NavLayout, type PrimaryNavGroup} from 'sentry/components/nav/types';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMedia from 'sentry/utils/useMedia';

export interface NavContext {
  activeGroup: PrimaryNavGroup | null;
  isCollapsed: boolean;
  isInteracting: boolean;
  layout: NavLayout;
  secondaryNavEl: HTMLElement | null;
  setActiveGroup: (group: PrimaryNavGroup | null) => void;
  setIsCollapsed: (isCollapsed: boolean) => void;
  setSecondaryNavEl: (el: HTMLElement | null) => void;
  setisInteracting: (isInteracting: boolean) => void;
}

const NavContext = createContext<NavContext>({
  secondaryNavEl: null,
  setSecondaryNavEl: () => {},
  layout: NavLayout.SIDEBAR,
  isCollapsed: false,
  setIsCollapsed: () => {},
  activeGroup: null,
  setActiveGroup: () => {},
  isInteracting: false,
  setisInteracting: () => {},
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
  const [isInteracting, setisInteracting] = useState(false);

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
      isInteracting,
      setisInteracting,
    }),
    [
      secondaryNavEl,
      isMobile,
      isCollapsed,
      setIsCollapsed,
      activeGroup,
      isInteracting,
      setisInteracting,
    ]
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}
