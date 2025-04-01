import {useLocation} from 'react-router-dom';

import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {unreachable} from 'sentry/utils/unreachable';
import {PRIMARY_NAV_GROUP_PATHS} from 'sentry/views/nav/constants';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

const CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX = /^\/([^\/]+)/;
const NON_CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX = /^\/organizations\/[^\/]+\/([^\/]+)/;

const getPrimaryRoutePath = (path: string) => {
  if (USING_CUSTOMER_DOMAIN) {
    return path.match(CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX)?.[1];
  }

  return path.match(NON_CUSTOMER_DOMAIN_PRIMARY_PATH_REGEX)?.[1];
};

export function useActiveNavGroup(): PrimaryNavGroup {
  const location = useLocation();

  const primaryPath = getPrimaryRoutePath(location.pathname) as
    | (typeof PRIMARY_NAV_GROUP_PATHS)[keyof typeof PRIMARY_NAV_GROUP_PATHS]
    | undefined;

  if (!primaryPath) {
    return PrimaryNavGroup.ISSUES;
  }

  switch (primaryPath) {
    case PRIMARY_NAV_GROUP_PATHS.issues:
      return PrimaryNavGroup.ISSUES;
    case PRIMARY_NAV_GROUP_PATHS.explore:
      return PrimaryNavGroup.EXPLORE;
    case PRIMARY_NAV_GROUP_PATHS.dashboards:
      return PrimaryNavGroup.DASHBOARDS;
    case PRIMARY_NAV_GROUP_PATHS.insights:
      return PrimaryNavGroup.INSIGHTS;
    case PRIMARY_NAV_GROUP_PATHS.settings:
      return PrimaryNavGroup.SETTINGS;
    case PRIMARY_NAV_GROUP_PATHS.pipeline:
      return PrimaryNavGroup.PIPELINE;
    default:
      unreachable(primaryPath);
      return PrimaryNavGroup.ISSUES;
  }
}
