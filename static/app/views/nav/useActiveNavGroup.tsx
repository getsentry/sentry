import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {useLocation} from 'sentry/utils/useLocation';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

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

export function useActiveNavGroup(): PrimaryNavGroup {
  const location = useLocation();

  const primaryPath = getPrimaryRoutePath(location.pathname);

  if (!primaryPath) {
    return PrimaryNavGroup.ISSUES;
  }

  for (const [navGroup, config] of Object.entries(PRIMARY_NAV_GROUP_CONFIG)) {
    if (config.basePaths.includes(primaryPath)) {
      return navGroup as PrimaryNavGroup;
    }
  }

  return PrimaryNavGroup.ISSUES;
}
