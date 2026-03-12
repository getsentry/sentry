import {createContext, useContext, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {useMedia} from 'sentry/utils/useMedia';
import {NavigationTourReminderContextProvider} from 'sentry/views/navigation/navigationTour';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';
import type {PrimaryNavigationGroup} from 'sentry/views/navigation/types';

interface NavigationContext {
  activePrimaryNavigationGroup: PrimaryNavigationGroup | null;
  layout: 'mobile' | 'sidebar';
  setActivePrimaryNavigationGroup: (
    activePrimaryNavigationGroup: PrimaryNavigationGroup | null
  ) => void;
}

const NavigationContext = createContext<NavigationContext>({
  layout: 'sidebar',
  activePrimaryNavigationGroup: null,
  setActivePrimaryNavigationGroup: () => {},
});

export function useNavigation(): NavigationContext {
  return useContext(NavigationContext);
}

interface NavigationContextProviderProps {
  children: React.ReactNode;
}

export function NavigationContextProvider(props: NavigationContextProviderProps) {
  const [activePrimaryNavigationGroup, setActivePrimaryNavigationGroup] =
    useState<PrimaryNavigationGroup | null>(null);

  const theme = useTheme();
  const isMobile = useMedia(`(width < ${theme.breakpoints.md})`);

  const value = useMemo(
    () => ({
      layout: isMobile ? ('mobile' as const) : ('sidebar' as const),
      activePrimaryNavigationGroup,
      setActivePrimaryNavigationGroup,
    }),
    [isMobile, activePrimaryNavigationGroup]
  );

  return (
    <NavigationTourReminderContextProvider>
      <SecondaryNavigationContextProvider>
        <NavigationContext.Provider value={value}>
          {props.children}
        </NavigationContext.Provider>
      </SecondaryNavigationContextProvider>
    </NavigationTourReminderContextProvider>
  );
}
