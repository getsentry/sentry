import {createContext, useCallback, useContext, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import * as Sentry from '@sentry/react';

import {useMedia} from '@sentry/scraps/useMedia';

import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

const PRIMARY_NAVIGATION_GROUP_CONFIG = {
  inbox: ['inbox'],
  issues: ['issues'],
  explore: ['explore', 'preprod'],
  seer: ['seer'],
  dashboards: ['dashboards', 'dashboard'],
  insights: ['insights'],
  projects: ['projects'], // No primary nav button — accessed via logo nav. Needed for secondary nav routing.
  monitors: ['monitors'],
  settings: ['settings'],
  prevent: ['prevent'],
  admin: ['manage'],
} as const;

type NavigationGroup = keyof typeof PRIMARY_NAVIGATION_GROUP_CONFIG;

const PRIMARY_NAVIGATION_ROUTE_OVERRIDES: Array<{
  group: NavigationGroup;
  pattern: RegExp;
  /** Only apply the override when the organization lacks this feature */
  unlessFeature?: string;
}> = [
  // Seer pages linked from Explore until the Seer primary nav ships.
  {
    group: 'explore',
    pattern: /(?:^|\/)seer\/(?:automations|investigations(?:\/[^/]+)?)\/?$/,
    unlessFeature: 'seer-primary-nav',
  },
];

interface PrimaryNavigationFeatures {
  /** Whether the device supports hover interactions (false on touch-only devices) */
  hover: boolean;
}

interface PrimaryNavigationContext {
  activeGroup: NavigationGroup;
  features: PrimaryNavigationFeatures;
  layout: 'mobile' | 'sidebar';
  setActiveGroup: (group: NavigationGroup | null) => void;
}

const PrimaryNavigationContext = createContext<PrimaryNavigationContext>({
  layout: 'sidebar',
  activeGroup: 'issues',
  features: {hover: true},
  setActiveGroup: () => {},
});

export function usePrimaryNavigation(): PrimaryNavigationContext {
  const context = useContext(PrimaryNavigationContext);
  const organization = useOrganization({allowNull: true});

  return organization ? context : {...context, activeGroup: 'settings'};
}

interface PrimaryNavigationContextProviderProps {
  children: React.ReactNode;
}

export function PrimaryNavigationContextProvider(
  props: PrimaryNavigationContextProviderProps
) {
  const [activeGroupOverride, setActiveGroupOverride] = useState<{
    group: NavigationGroup;
    routeGroup: NavigationGroup;
  } | null>(null);

  const theme = useTheme();
  // Primary navigation switches at the viewport breakpoint.
  // oxlint-disable-next-line @sentry/scraps/prefer-container-responsive-props
  const isMobile = useMedia(`(width < ${theme.breakpoints.md})`);
  const hasHover = useMedia('(hover: hover)');
  const activeRouteGroup = useActiveNavigationGroup();

  // An override only lasts for the route group it was set under. Otherwise it
  // sticks after navigating elsewhere (e.g. tapping Explore on mobile, then
  // opening Settings from the org menu), leaving a stale secondary navigation.
  // Clear it rather than ignore it, so it cannot come back when the user
  // returns to the route group it was set under.
  if (activeGroupOverride && activeGroupOverride.routeGroup !== activeRouteGroup) {
    setActiveGroupOverride(null);
  }
  const activeGroupOverrideForRoute =
    activeGroupOverride?.routeGroup === activeRouteGroup
      ? activeGroupOverride.group
      : null;

  const setActiveGroup = useCallback(
    (group: NavigationGroup | null) =>
      setActiveGroupOverride(group ? {group, routeGroup: activeRouteGroup} : null),
    [activeRouteGroup]
  );

  const value = useMemo(
    () => ({
      layout: isMobile ? ('mobile' as const) : ('sidebar' as const),
      features: {hover: hasHover},
      activeGroup: activeGroupOverrideForRoute ?? activeRouteGroup,
      setActiveGroup,
    }),
    [isMobile, hasHover, activeGroupOverrideForRoute, activeRouteGroup, setActiveGroup]
  );

  return (
    <SecondaryNavigationContextProvider>
      <PrimaryNavigationContext.Provider value={value}>
        {props.children}
      </PrimaryNavigationContext.Provider>
    </SecondaryNavigationContextProvider>
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
  const organization = useOrganization({allowNull: true});
  const routeOverride = PRIMARY_NAVIGATION_ROUTE_OVERRIDES.find(
    ({pattern, unlessFeature}) =>
      pattern.test(location.pathname) &&
      !(unlessFeature && organization?.features.includes(unlessFeature))
  );
  if (routeOverride) {
    return routeOverride.group;
  }

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
