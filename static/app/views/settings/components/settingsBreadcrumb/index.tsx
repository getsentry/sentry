import {Link as RouterLink} from 'react-router-dom';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import recreateRoute from 'sentry/utils/recreateRoute';

import {useBreadcrumbsPathmap} from './context';
import Divider from './divider';
import {OrganizationCrumb} from './organizationCrumb';
import ProjectCrumb from './projectCrumb';
import TeamCrumb from './teamCrumb';
import type {RouteWithName, SettingsBreadcrumbProps} from './types';

const MENUS: Record<string, React.FC<SettingsBreadcrumbProps>> = {
  Organization: OrganizationCrumb,
  Project: ProjectCrumb,
  Team: TeamCrumb,
} as const;

type Props = {
  params: Record<string, string | undefined>;
  routes: RouteWithName[];
  className?: string;
};

function SettingsBreadcrumb({className, routes, params}: Props) {
  const pathMap = useBreadcrumbsPathmap();

  const lastRouteIndex = routes.map(r => !!r.name).lastIndexOf(true);

  function onSettingsBreadcrumbLinkClick() {
    trackAnalytics('breadcrumbs.link.clicked', {organization: null});
  }

  return (
    <Flex
      as="nav"
      align="center"
      gap="sm"
      aria-label={t('Settings Breadcrumbs')}
      className={className}
    >
      {routes.map((route, i) => {
        if (!route.name) {
          return null;
        }
        const pathTitle = pathMap[getRouteStringFromRoutes(routes.slice(0, i + 1))];
        const isLast = i === lastRouteIndex;
        const Menu = MENUS[route.name];
        const hasMenu = !!Menu;

        if (hasMenu) {
          return (
            <Menu
              key={`${route.name}:${route.path}`}
              routes={routes}
              route={route}
              isLast={isLast}
            />
          );
        }
        return (
          <Flex gap="sm" align="center" key={`${route.name}:${route.path}`}>
            <CrumbLink
              to={recreateRoute(route, {routes, params})}
              onClick={onSettingsBreadcrumbLinkClick}
            >
              {pathTitle || route.name}
            </CrumbLink>
            {isLast ? null : <Divider />}
          </Flex>
        );
      })}
    </Flex>
  );
}

// Uses Link directly from react-router-dom to avoid the URL normalization
// that happens in the internal Link component. It is unnecessary because we
// get routes from the router, and will actually cause issues because the
// routes do not have organization information.
export const CrumbLink = styled(RouterLink)`
  display: block;

  color: ${p => p.theme.tokens.content.secondary};
  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

export default SettingsBreadcrumb;
