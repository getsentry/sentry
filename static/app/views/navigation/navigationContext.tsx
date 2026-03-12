import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';

import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import {NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/views/navigation/constants';
import {NavigationTourReminderContextProvider} from 'sentry/views/navigation/navigationTour';
import {PRIMARY_NAVIGATION_GROUP_CONFIG} from 'sentry/views/navigation/primary/config';
import {NavigationLayout, PrimaryNavigationGroup} from 'sentry/views/navigation/types';

interface NavigationContext {
  activeNavigationGroup: PrimaryNavigationGroup;
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
  activeNavigationGroup: PrimaryNavigationGroup.ISSUES,
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
  const location = useLocation();

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

  const urlNavigationGroup = getNavigationGroupFromPath(location.pathname);
  const activeNavigationGroup = activePrimaryNavigationGroup ?? urlNavigationGroup;

  const value = useMemo(
    () => ({
      navigationParentRef,
      layout: isMobile ? NavigationLayout.MOBILE : NavigationLayout.SIDEBAR,
      isCollapsed,
      setIsCollapsed,
      isInteractingRef,
      startInteraction,
      endInteraction,
      activeNavigationGroup,
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
      activeNavigationGroup,
      activePrimaryNavigationGroup,
      setActivePrimaryNavigationGroup,
      collapsedNavigationIsOpen,
      setCollapsedNavigationIsOpen,
    ]
  );

  return (
    <NavigationTourReminderContextProvider>
      <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
    </NavigationTourReminderContextProvider>
  );
}

const CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX = /^\/([^/]+)/;
const NON_CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX = /^\/organizations\/[^/]+\/([^/]+)/;

function getPrimaryRoutePath(path: string): string | undefined {
  if (USING_CUSTOMER_DOMAIN) {
    return path.match(CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX)?.[1];
  }

  return (
    path.match(NON_CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX)?.[1] ??
    path.match(CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX)?.[1]
  );
}

export function getNavigationGroupFromPath(path: string): PrimaryNavigationGroup {
  const primaryPath = getPrimaryRoutePath(path);

  if (!primaryPath) {
    return PrimaryNavigationGroup.ISSUES;
  }

  for (const [navigationGroup, config] of Object.entries(
    PRIMARY_NAVIGATION_GROUP_CONFIG
  )) {
    if (config.basePaths.includes(primaryPath)) {
      return navigationGroup as PrimaryNavigationGroup;
    }
  }

  return PrimaryNavigationGroup.ISSUES;
}
