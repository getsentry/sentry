import {createContext, useContext, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {useMedia} from 'sentry/utils/useMedia';
import {NavigationTourReminderContextProvider} from 'sentry/views/navigation/navigationTour';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';
import {
  PRIMARY_NAVIGATION_GROUP_CONFIG,
  useActiveNavigationGroup,
} from 'sentry/views/navigation/useActiveNavigationGroup';

type NavigationGroup = keyof typeof PRIMARY_NAVIGATION_GROUP_CONFIG;

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
  const routeGroup = useActiveNavigationGroup();

  const value = useMemo(
    () => ({
      layout: isMobile ? ('mobile' as const) : ('sidebar' as const),
      activeGroup: activeGroupOverride ?? routeGroup,
      setActiveGroup,
    }),
    [isMobile, activeGroupOverride, routeGroup]
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
