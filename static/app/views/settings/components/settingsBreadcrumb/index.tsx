import {Link as RouterLink} from 'react-router-dom';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {trackAnalytics} from 'sentry/utils/analytics';
import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';
import {recreateRoute} from 'sentry/utils/recreateRoute';
import {useRoutes} from 'sentry/utils/useRoutes';

import {useBreadcrumbsPathmap} from './context';
import {Divider} from './divider';
import {IntegrationCrumb} from './integrationCrumb';
import {ProjectCrumb} from './projectCrumb';
import {TeamCrumb} from './teamCrumb';
import type {RouteWithName} from './types';

const MENU_ROUTE_PATHS = {
  configureIntegration: ':providerKey/:integrationId/',
  integrations: 'integrations/',
  integrationDetails: ':integrationSlug',
  project: 'projects/:projectId/',
  sentryApps: 'sentry-apps/',
  team: ':teamId/',
} as const;

function getMenuForRoute(path: string | undefined, routes: RouteWithName[]) {
  switch (path) {
    case MENU_ROUTE_PATHS.configureIntegration:
      return IntegrationCrumb;
    case MENU_ROUTE_PATHS.integrationDetails:
      return routes.some(
        route =>
          route.path === MENU_ROUTE_PATHS.integrations ||
          route.path === MENU_ROUTE_PATHS.sentryApps
      )
        ? IntegrationCrumb
        : undefined;
    case MENU_ROUTE_PATHS.project:
      return ProjectCrumb;
    case MENU_ROUTE_PATHS.team:
      return TeamCrumb;
    default:
      return;
  }
}

type Props = {
  params: Record<string, string | undefined>;
};

export function SettingsBreadcrumb({params}: Props) {
  const routes = useRoutes() as RouteWithName[];
  const pathMap = useBreadcrumbsPathmap();

  const lastRouteIndex = routes.map(r => !!r.name).lastIndexOf(true);

  function onSettingsBreadcrumbLinkClick() {
    trackAnalytics('breadcrumbs.link.clicked', {organization: null});
  }

  return (
    <Flex as="span" flex="0 1 auto" align="center" gap="sm" minWidth="0">
      {routes.map((route, i) => {
        if (!route.name) {
          return null;
        }
        const pathTitle =
          pathMap[getRouteStringFromRoutes({routes: routes.slice(0, i + 1)})];
        const isLast = i === lastRouteIndex;
        const Menu = getMenuForRoute(route.path, routes);

        if (Menu) {
          return (
            <Menu
              key={`${route.name}:${route.path}`}
              routes={routes}
              route={route}
              isLast={isLast}
            />
          );
        }
        if (isLast) {
          return (
            <Text key={`${route.name}:${route.path}`} as="span">
              {pathTitle || route.name}
            </Text>
          );
        }
        return (
          <Flex as="span" gap="sm" align="center" key={`${route.name}:${route.path}`}>
            <CrumbLink
              to={recreateRoute(route, {routes, params})}
              onClick={onSettingsBreadcrumbLinkClick}
            >
              {pathTitle || route.name}
            </CrumbLink>
            <Divider />
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
  line-height: ${p => p.theme.font.lineHeight.default};

  color: ${p => p.theme.tokens.content.secondary};
  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;
