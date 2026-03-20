import {createContext, useContext, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import * as Sentry from '@sentry/react';

import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {useLocation} from 'sentry/utils/useLocation';
import {useMedia} from 'sentry/utils/useMedia';
import {NavigationTourReminderContextProvider} from 'sentry/views/navigation/navigationTour';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

const PRIMARY_NAVIGATION_GROUP_CONFIG = {
  issues: ['issues'],
  explore: ['explore'],
  dashboards: ['dashboards', 'dashboard'],
  insights: ['insights'],
  monitors: ['monitors'],
  settings: ['settings'],
  prevent: ['prevent'],
  admin: ['manage'],
} as const;

type NavigationGroup = keyof typeof PRIMARY_NAVIGATION_GROUP_CONFIG;

interface PrimaryNavigationContext {
  activeGroup: NavigationGroup;
  layout: 'mobile' | 'sidebar';
  setActiveGroup: (group: NavigationGroup | null) => void;
}

const PrimaryNavigationContext = createContext<PrimaryNavigationContext>({
  layout: 'sidebar',
  activeGroup: 'issues',
  setActiveGroup: () => {},
});

export function usePrimaryNavigation(): PrimaryNavigationContext {
  return useContext(PrimaryNavigationContext);
}

interface PrimaryNavigationContextProviderProps {
  children: React.ReactNode;
}

export function PrimaryNavigationContextProvider(
  props: PrimaryNavigationContextProviderProps
) {
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
        <PrimaryNavigationContext.Provider value={value}>
          {props.children}
        </PrimaryNavigationContext.Provider>
      </SecondaryNavigationContextProvider>
    </NavigationTourReminderContextProvider>
  );
}

const CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX = /^\/([^/]+)/;
const NON_CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX = /^\/organizations\/[^/]+\/([^/]+)/;

const getPrimaryRoutePath = (path: string): string | undefined => {
  if (USING_CUSTOMER_DOMAIN) {
    return path.match(CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX)?.[1];
  }

  return (
    path.match(NON_CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX)?.[1] ??
    path.match(CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX)?.[1]
  );
};

function useActiveNavigationGroup(): NavigationGroup {
  const location = useLocation();
  const primaryPath = getPrimaryRoutePath(location.pathname);

  if (!primaryPath) {
    return 'issues';
  }

  for (const key in PRIMARY_NAVIGATION_GROUP_CONFIG) {
    if (
      (
        PRIMARY_NAVIGATION_GROUP_CONFIG[key as NavigationGroup] as readonly string[]
      ).includes(primaryPath)
    ) {
      return key as NavigationGroup;
    }
  }

  Sentry.logger.warn('Unknown navigation group, defaulting to issues', {
    path: primaryPath,
  });
  return 'issues';
}
