import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMedia from 'sentry/utils/useMedia';
import {NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/views/navigation/constants';
import {NavigationTourContextProvider} from 'sentry/views/navigation/tour/tour';
import type {PrimaryNavGroup} from 'sentry/views/navigation/types';
import {NavLayout} from 'sentry/views/navigation/types';

interface NavigationContext {
  activePrimaryNavGroup: PrimaryNavGroup | null;
  collapsedNavIsOpen: boolean;
  endInteraction: () => void;
  isCollapsed: boolean;
  isInteractingRef: React.RefObject<boolean | null>;
  layout: NavLayout;
  navParentRef: React.RefObject<HTMLDivElement | null>;
  setActivePrimaryNavGroup: (activePrimaryNavGroup: PrimaryNavGroup | null) => void;
  setCollapsedNavIsOpen: (collapsedNavIsOpen: boolean) => void;
  setIsCollapsed: (isCollapsed: boolean) => void;
  startInteraction: () => void;
}

const NavigationContext = createContext<NavigationContext>({
  navParentRef: {current: null},
  layout: NavLayout.SIDEBAR,
  isCollapsed: false,
  setIsCollapsed: () => {},
  isInteractingRef: {current: false},
  startInteraction: () => {},
  endInteraction: () => {},
  activePrimaryNavGroup: null,
  setActivePrimaryNavGroup: () => {},
  collapsedNavIsOpen: false,
  setCollapsedNavIsOpen: () => {},
});

export function useNavigationContext(): NavigationContext {
  return useContext(NavigationContext);
}

export function NavigationContextProvider({children}: {children: React.ReactNode}) {
  const navParentRef = useRef<HTMLDivElement>(null);
  const isInteractingRef = useRef(false);
  const [isCollapsed, setIsCollapsed] = useLocalStorageState(
    NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
    false
  );
  const [collapsedNavIsOpen, setCollapsedNavIsOpen] = useState(false);
  const [activePrimaryNavGroup, setActivePrimaryNavGroup] =
    useState<PrimaryNavGroup | null>(null);

  const theme = useTheme();
  const isMobile = useMedia(`(width < ${theme.breakpoints.md})`);

  const startInteraction = useCallback(() => {
    isInteractingRef.current = true;
  }, []);

  const endInteraction = useCallback(() => {
    isInteractingRef.current = false;
  }, []);

  const value = useMemo(
    () => ({
      navParentRef,
      layout: isMobile ? NavLayout.MOBILE : NavLayout.SIDEBAR,
      isCollapsed,
      setIsCollapsed,
      isInteractingRef,
      startInteraction,
      endInteraction,
      activePrimaryNavGroup,
      setActivePrimaryNavGroup,
      collapsedNavIsOpen,
      setCollapsedNavIsOpen,
    }),
    [
      isMobile,
      isCollapsed,
      setIsCollapsed,
      startInteraction,
      endInteraction,
      activePrimaryNavGroup,
      setActivePrimaryNavGroup,
      collapsedNavIsOpen,
      setCollapsedNavIsOpen,
    ]
  );

  return (
    <NavigationTourContextProvider>
      <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
    </NavigationTourContextProvider>
  );
}
