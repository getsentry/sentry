import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {useLocation} from 'sentry/utils/useLocation';
import {
  PRIMARY_NAVIGATION_GROUP_CONFIG,
  PrimaryNavigationGroup,
} from 'sentry/views/navigation/primary/config';

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

export function useActiveNavigationGroup(): PrimaryNavigationGroup {
  const location = useLocation();

  const primaryPath = getPrimaryRoutePath(location.pathname);

  if (!primaryPath) {
    return PrimaryNavigationGroup.ISSUES;
  }

  for (const [navigationGroup, config] of Object.entries(
    PRIMARY_NAVIGATION_GROUP_CONFIG
  )) {
    if (config.includes(primaryPath)) {
      return navigationGroup as PrimaryNavigationGroup;
    }
  }

  return PrimaryNavigationGroup.ISSUES;
}
