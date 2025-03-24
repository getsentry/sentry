import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';

import {NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/components/nav/constants';
import {NavLayout, type PrimaryNavGroup} from 'sentry/components/nav/types';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMedia from 'sentry/utils/useMedia';

export interface NavContext {
  activeGroup: PrimaryNavGroup | null;
  endInteraction: () => void;
  isCollapsed: boolean;
  isInteractingRef: React.RefObject<boolean>;
  layout: NavLayout;
  navParentRef: React.RefObject<HTMLDivElement>;
  secondaryNavEl: HTMLElement | null;
  setActiveGroup: (group: PrimaryNavGroup | null) => void;
  setIsCollapsed: (isCollapsed: boolean) => void;
  setSecondaryNavEl: (el: HTMLElement | null) => void;
  startInteraction: () => void;
}

const NavContext = createContext<NavContext>({
  navParentRef: {current: null},
  secondaryNavEl: null,
  setSecondaryNavEl: () => {},
  layout: NavLayout.SIDEBAR,
  isCollapsed: false,
  setIsCollapsed: () => {},
  activeGroup: null,
  setActiveGroup: () => {},
  isInteractingRef: {current: false},
  startInteraction: () => {},
  endInteraction: () => {},
});

export function useNavContext(): NavContext {
  return useContext(NavContext);
}

export function NavContextProvider({children}: {children: React.ReactNode}) {
  const navParentRef = useRef<HTMLDivElement>(null);
  const isInteractingRef = useRef(false);
  const [isCollapsed, setIsCollapsed] = useLocalStorageState(
    NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
    false
  );
  const [secondaryNavEl, setSecondaryNavEl] = useState<HTMLElement | null>(null);
  const [activeGroup, setActiveGroup] = useState<PrimaryNavGroup | null>(null);

  const theme = useTheme();
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.medium})`);

  const startInteraction = useCallback(() => {
    isInteractingRef.current = true;
  }, []);

  const endInteraction = useCallback(() => {
    isInteractingRef.current = false;
  }, []);

  const value = useMemo(
    () => ({
      navParentRef,
      secondaryNavEl,
      setSecondaryNavEl,
      layout: isMobile ? NavLayout.MOBILE : NavLayout.SIDEBAR,
      isCollapsed,
      setIsCollapsed,
      activeGroup,
      setActiveGroup,
      isInteractingRef,
      startInteraction,
      endInteraction,
    }),
    [
      secondaryNavEl,
      isMobile,
      isCollapsed,
      setIsCollapsed,
      activeGroup,
      startInteraction,
      endInteraction,
    ]
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}
