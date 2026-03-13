import {createContext, useContext, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {useMedia} from 'sentry/utils/useMedia';
import {NavigationTourReminderContextProvider} from 'sentry/views/navigation/navigationTour';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';
import {
  useActiveNavigationGroup,
  type NavigationGroup,
} from 'sentry/views/navigation/useActiveNavigationGroup';

interface NavigationContext {
  activeGroup: NavigationGroup;
  layout: 'mobile' | 'sidebar';
  setActiveGroup: (group: NavigationGroup | null) => void;
}

const NavigationContext = createContext<NavigationContext>({
  layout: 'sidebar',
  activeGroup: 'issues',
  setActiveGroup: () => {},
});

export function useNavigation(): NavigationContext {
  return useContext(NavigationContext);
}

interface NavigationContextProviderProps {
  children: React.ReactNode;
}

export function NavigationContextProvider(props: NavigationContextProviderProps) {
  const [activeGroupOverride, setActiveGroup] = useState<NavigationGroup | null>(null);

  const theme = useTheme();
  const isMobile = useMedia(`(width < ${theme.breakpoints.md})`);
  const activeRouteGroup = useActiveNavigationGroup();

  const value = useMemo(
    () => ({
      layout: isMobile ? ('mobile' as const) : ('sidebar' as const),
      activeGroup: activeGroupOverride ?? activeRouteGroup,
      setActiveGroup,
    }),
    [isMobile, activeGroupOverride, activeRouteGroup]
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
