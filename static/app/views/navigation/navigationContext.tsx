import {createContext, useContext, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';

import useMedia from 'sentry/utils/useMedia';
import {NavigationTourReminderContextProvider} from 'sentry/views/navigation/navigationTour';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';
import type {PrimaryNavigationGroup} from 'sentry/views/navigation/types';

interface NavigationContext {
  activePrimaryNavigationGroup: PrimaryNavigationGroup | null;
  layout: 'mobile' | 'sidebar';
  navigationParentRef: React.RefObject<HTMLDivElement | null>;
  setActivePrimaryNavigationGroup: (
    activePrimaryNavigationGroup: PrimaryNavigationGroup | null
  ) => void;
}

const NavigationContext = createContext<NavigationContext>({
  layout: 'sidebar',
  navigationParentRef: {current: null},
  activePrimaryNavigationGroup: null,
  setActivePrimaryNavigationGroup: () => {},
});

export function useNavigation(): NavigationContext {
  return useContext(NavigationContext);
}

export function NavigationContextProvider({children}: {children: React.ReactNode}) {
  const navigationParentRef = useRef<HTMLDivElement>(null);

  const [activePrimaryNavigationGroup, setActivePrimaryNavigationGroup] =
    useState<PrimaryNavigationGroup | null>(null);

  const theme = useTheme();
  const isMobile = useMedia(`(width < ${theme.breakpoints.md})`);

  const value = useMemo(
    () => ({
      navigationParentRef,
      layout: isMobile ? ('mobile' as const) : ('sidebar' as const),
      activePrimaryNavigationGroup,
      setActivePrimaryNavigationGroup,
    }),
    [isMobile, activePrimaryNavigationGroup]
  );

  return (
    <NavigationTourReminderContextProvider>
      <SecondaryNavigationContextProvider>
        <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
      </SecondaryNavigationContextProvider>
    </NavigationTourReminderContextProvider>
  );
}
