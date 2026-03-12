import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';

import useMedia from 'sentry/utils/useMedia';
import {NavigationTourReminderContextProvider} from 'sentry/views/navigation/navigationTour';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';
import type {PrimaryNavigationGroup} from 'sentry/views/navigation/types';

interface NavigationContext {
  activePrimaryNavigationGroup: PrimaryNavigationGroup | null;
  endInteraction: () => void;
  isInteractingRef: React.RefObject<boolean | null>;
  layout: 'mobile' | 'sidebar';
  navigationParentRef: React.RefObject<HTMLDivElement | null>;
  setActivePrimaryNavigationGroup: (
    activePrimaryNavigationGroup: PrimaryNavigationGroup | null
  ) => void;
  startInteraction: () => void;
}

const NavigationContext = createContext<NavigationContext>({
  layout: 'sidebar',
  navigationParentRef: {current: null},
  isInteractingRef: {current: false},
  startInteraction: () => {},
  endInteraction: () => {},
  activePrimaryNavigationGroup: null,
  setActivePrimaryNavigationGroup: () => {},
});

export function useNavigation(): NavigationContext {
  return useContext(NavigationContext);
}

export function NavigationContextProvider({children}: {children: React.ReactNode}) {
  const navigationParentRef = useRef<HTMLDivElement>(null);

  const isInteractingRef = useRef(false);
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
      layout: isMobile ? ('mobile' as const) : ('sidebar' as const),
      isInteractingRef,
      startInteraction,
      endInteraction,
      activePrimaryNavigationGroup,
      setActivePrimaryNavigationGroup,
    }),
    [isMobile, startInteraction, endInteraction, activePrimaryNavigationGroup]
  );

  return (
    <NavigationTourReminderContextProvider>
      <SecondaryNavigationContextProvider>
        <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
      </SecondaryNavigationContextProvider>
    </NavigationTourReminderContextProvider>
  );
}
