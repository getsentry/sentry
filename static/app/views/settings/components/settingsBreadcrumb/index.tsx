import type {ComponentType} from 'react';

import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';

import {ConfigStore} from 'sentry/stores/configStore';
import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';
import {recreateRoute} from 'sentry/utils/recreateRoute';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import {TopBar} from 'sentry/views/navigation/topBar';

import {useBreadcrumbsPathmap} from './context';
import {IntegrationCrumb} from './integrationCrumb';
import {ProjectCrumb} from './projectCrumb';
import {TeamCrumb} from './teamCrumb';
import type {RouteWithName, SettingsBreadcrumbProps} from './types';

function getCrumbComponent(
  route: RouteWithName,
  routes: RouteWithName[]
): ComponentType<SettingsBreadcrumbProps> | undefined {
  switch (route.path) {
    case ':providerKey/:integrationId/':
      return IntegrationCrumb;
    case ':integrationSlug':
      return routes.some(
        item => item.path === 'integrations/' || item.path === 'sentry-apps/'
      )
        ? IntegrationCrumb
        : undefined;
    case 'projects/:projectId/':
      return ProjectCrumb;
    case ':teamId/':
      return TeamCrumb;
    default:
      return undefined;
  }
}

type Props = {params: Record<string, string | undefined>};

export function SettingsBreadcrumb({params}: Props) {
  const organization = useOrganization({allowNull: true});
  const routes = useRoutes() as RouteWithName[];
  const pathMap = useBreadcrumbsPathmap();
  const lastRouteIndex = routes.map(route => !!route.name).lastIndexOf(true);
  const lastRoute = routes[lastRouteIndex];
  if (!lastRoute) {
    return null;
  }
  const explicitTitle =
    pathMap[getRouteStringFromRoutes({routes: routes.slice(0, lastRouteIndex + 1)})];
  const title = explicitTitle?.title ?? {
    type: 'page-title' as const,
    label: lastRoute.name || '',
  };
  const items: BreadcrumbListProps['items'] = [];
  let dynamicCrumb:
    | {
        Component: ComponentType<SettingsBreadcrumbProps>;
        isLast: boolean;
        itemIndex: number;
        route: RouteWithName;
      }
    | undefined;

  for (const [index, route] of routes.entries()) {
    if (!route.name) {
      continue;
    }
    const Component = getCrumbComponent(route, routes);
    if (Component) {
      // Settings routes contain at most one project, team, or integration crumb.
      dynamicCrumb = {
        Component,
        route,
        itemIndex: items.length,
        isLast: index === lastRouteIndex && !explicitTitle,
      };
    } else if (index !== lastRouteIndex) {
      const pathTitle =
        pathMap[getRouteStringFromRoutes({routes: routes.slice(0, index + 1)})]?.title;
      const label =
        pathTitle?.type === 'editable-title' ? pathTitle.value : pathTitle?.label;
      let to = recreateRoute(route, {routes, params});
      // Route paths on customer domains already omit the organization. Restore
      // it before the shared Link normalizes the destination once more.
      if (
        ConfigStore.get('customerDomain') &&
        organization &&
        to.startsWith('/settings/') &&
        to !== '/settings/' &&
        !to.startsWith('/settings/account/') &&
        !to.startsWith(`/settings/${organization.slug}/`)
      ) {
        to = `/settings/${organization.slug}/${to.slice('/settings/'.length)}`;
      }
      items.push({type: 'link', label: label || route.name, to});
    }
  }
  items.push(...(explicitTitle?.breadcrumbs ?? []));

  if (dynamicCrumb) {
    const {Component, ...props} = dynamicCrumb;
    return <Component {...props} routes={routes} items={items} title={title} />;
  }
  return <TopBar.Slot name="breadcrumbs" title={title} items={items} />;
}
