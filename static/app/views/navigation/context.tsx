import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMedia from 'sentry/utils/useMedia';
import {NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/views/navigation/constants';
import {NavigationTourProvider} from 'sentry/views/navigation/navigationTour';
import type {PrimaryNavigationGroup} from 'sentry/views/navigation/types';
import {NavigationLayout} from 'sentry/views/navigation/types';

interface NavigationContext {
  activePrimaryNavigationGroup: PrimaryNavigationGroup | null;
  collapsedNavigationIsOpen: boolean;
  endInteraction: () => void;
  isCollapsed: boolean;
  isInteractingRef: React.RefObject<boolean | null>;
  layout: NavigationLayout;
  navigationParentRef: React.RefObject<HTMLDivElement | null>;
  setActivePrimaryNavigationGroup: (
    activePrimaryNavigationGroup: PrimaryNavigationGroup | null
  ) => void;
  setCollapsedNavigationIsOpen: (collapsedNavigationIsOpen: boolean) => void;
  setIsCollapsed: (isCollapsed: boolean) => void;
  startInteraction: () => void;
}

const NavigationContext = createContext<NavigationContext>({
  navigationParentRef: {current: null},
  layout: NavigationLayout.SIDEBAR,
  isCollapsed: false,
  setIsCollapsed: () => {},
  isInteractingRef: {current: false},
  startInteraction: () => {},
  endInteraction: () => {},
  activePrimaryNavigationGroup: null,
  setActivePrimaryNavigationGroup: () => {},
  collapsedNavigationIsOpen: false,
  setCollapsedNavigationIsOpen: () => {},
});

export function useNavigationContext(): NavigationContext {
  return useContext(NavigationContext);
}

export function NavigationContextProvider({children}: {children: React.ReactNode}) {
  const navigationParentRef = useRef<HTMLDivElement>(null);
  const isInteractingRef = useRef(false);
  const [isCollapsed, setIsCollapsed] = useLocalStorageState(
    NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
    false
  );
  const [collapsedNavigationIsOpen, setCollapsedNavigationIsOpen] = useState(false);
  const [activePrimaryNavigationGroup, setActivePrimaryNavigationGroup] =
    useState<PrimaryNavigationGroup | null>(null);

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
      navigationParentRef,
      layout: isMobile ? NavigationLayout.MOBILE : NavigationLayout.SIDEBAR,
      isCollapsed,
      setIsCollapsed,
      isInteractingRef,
      startInteraction,
      endInteraction,
      activePrimaryNavigationGroup,
      setActivePrimaryNavigationGroup,
      collapsedNavigationIsOpen,
      setCollapsedNavigationIsOpen,
    }),
    [
      isMobile,
      isCollapsed,
      setIsCollapsed,
      startInteraction,
      endInteraction,
      activePrimaryNavigationGroup,
      setActivePrimaryNavigationGroup,
      collapsedNavigationIsOpen,
      setCollapsedNavigationIsOpen,
    ]
  );

  return (
    <NavigationTourProvider>
      <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
    </NavigationTourProvider>
  );
}
