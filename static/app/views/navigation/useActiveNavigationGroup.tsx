import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {useLocation} from 'sentry/utils/useLocation';

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

export type NavigationGroup = keyof typeof PRIMARY_NAVIGATION_GROUP_CONFIG;

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

export function useActiveNavigationGroup(): NavigationGroup {
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

  return 'issues';
}
