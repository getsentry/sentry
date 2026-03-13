import {createContext, useContext, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {useMedia} from 'sentry/utils/useMedia';
import {
  NavigationTourProvider,
  NavigationTourReminderContextProvider,
} from 'sentry/views/navigation/navigationTour';
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
          <NavigationTourProvider>{props.children}</NavigationTourProvider>
        </NavigationContext.Provider>
      </SecondaryNavigationContextProvider>
    </NavigationTourReminderContextProvider>
  );
}
