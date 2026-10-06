import {Fragment} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import styled from '@emotion/styled';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Flex} from '@sentry/scraps/layout';

import {trackAnalytics} from 'sentry/utils/analytics';
import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';
import {recreateRoute} from 'sentry/utils/recreateRoute';
import {useRoutes} from 'sentry/utils/useRoutes';
import {TopBar} from 'sentry/views/navigation/topBar';

import {useBreadcrumbsPathmap} from './context';
import {Divider} from './divider';
import {IntegrationCrumb} from './integrationCrumb';
import {ProjectCrumb} from './projectCrumb';
import {TeamCrumb} from './teamCrumb';
import type {RouteWithName, SettingsBreadcrumbProps} from './types';

const MENU_ROUTE_PATHS = {
  configureIntegration: ':providerKey/:integrationId/',
  integrations: 'integrations/',
  integrationDetails: ':integrationSlug',
  project: 'projects/:projectId/',
  sentryApps: 'sentry-apps/',
  team: ':teamId/',
} as const;

function renderMenuForRoute(props: SettingsBreadcrumbProps) {
  const {
    route: {path},
    routes,
  } = props;
  switch (path) {
    case MENU_ROUTE_PATHS.configureIntegration:
      return <IntegrationCrumb {...props} />;
    case MENU_ROUTE_PATHS.integrationDetails:
      return routes.some(
        route =>
          route.path === MENU_ROUTE_PATHS.integrations ||
          route.path === MENU_ROUTE_PATHS.sentryApps
      ) ? (
        <IntegrationCrumb {...props} />
      ) : undefined;
    case MENU_ROUTE_PATHS.project:
      return <ProjectCrumb {...props} />;
    case MENU_ROUTE_PATHS.team:
      return <TeamCrumb {...props} />;
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

  const lastRoute = routes[lastRouteIndex];
  if (!lastRoute) {
    return null;
  }
  const explicitTitle =
    pathMap[getRouteStringFromRoutes({routes: routes.slice(0, lastRouteIndex + 1)})];
  const parentCrumbs = (
    <Flex as="span" flex="0 1 auto" align="center" gap="sm" minWidth="0">
      {routes.map((route, i) => {
        if (!route.name || i === lastRouteIndex) {
          return null;
        }
        const pathTitle =
          pathMap[getRouteStringFromRoutes({routes: routes.slice(0, i + 1)})]?.title;
        const label =
          pathTitle?.type === 'editable-title' ? pathTitle.value : pathTitle?.label;
        const menu = renderMenuForRoute({route, routes, isLast: false});
        return menu ? (
          <Fragment key={`${route.name}:${route.path}`}>{menu}</Fragment>
        ) : (
          <Flex as="span" gap="sm" align="center" key={`${route.name}:${route.path}`}>
            <CrumbLink
              to={recreateRoute(route, {routes, params})}
              onClick={onSettingsBreadcrumbLinkClick}
            >
              {label || route.name}
            </CrumbLink>
            <Divider />
          </Flex>
        );
      })}
    </Flex>
  );
  const menu = renderMenuForRoute({
    route: lastRoute,
    routes,
    isLast: !explicitTitle,
    children: parentCrumbs,
  });
  if (menu && !explicitTitle) {
    return menu;
  }
  return (
    <TopBar.Slot
      name="breadcrumbs"
      title={explicitTitle?.title ?? {type: 'page-title', label: lastRoute.name || ''}}
    >
      {parentCrumbs}
      {menu}
      {explicitTitle?.breadcrumbs && <BreadcrumbList items={explicitTitle.breadcrumbs} />}
    </TopBar.Slot>
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
