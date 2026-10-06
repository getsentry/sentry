import type {ComponentType} from 'react';

import type {
  BreadcrumbListProps,
  BreadcrumbTitleItem,
} from '@sentry/scraps/breadcrumbList';

import {ConfigStore} from 'sentry/stores/configStore';
import {recreateRoute} from 'sentry/utils/recreateRoute';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import {TopBar} from 'sentry/views/navigation/topBar';

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

type Props = {
  breadcrumbs?: BreadcrumbListProps['items'];
  /** Use route names only when no page supplies a title. */
  fallback?: boolean;
  title?: string | BreadcrumbTitleItem;
};

export function BreadcrumbTitle({title: explicitTitle, breadcrumbs, fallback}: Props) {
  const organization = useOrganization({allowNull: true});
  const routes = useRoutes() as RouteWithName[];
  const params = useParams();
  const lastRouteIndex = routes.map(route => !!route.name).lastIndexOf(true);
  const lastRoute = routes[lastRouteIndex];
  if (!lastRoute && explicitTitle === undefined) {
    return null;
  }
  const title: BreadcrumbTitleItem =
    typeof explicitTitle === 'string'
      ? {type: 'page-title', label: explicitTitle}
      : (explicitTitle ?? {type: 'page-title', label: lastRoute?.name ?? ''});
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
        isLast: index === lastRouteIndex && explicitTitle === undefined,
      };
    } else if (index !== lastRouteIndex) {
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
      items.push({type: 'link', label: route.name, to});
    }
  }
  items.push(...(breadcrumbs ?? []));

  if (dynamicCrumb) {
    const {Component, ...props} = dynamicCrumb;
    return (
      <Component
        {...props}
        routes={routes}
        items={items}
        title={title}
        fallback={fallback}
      />
    );
  }
  return (
    <TopBar.Slot name="breadcrumbs" title={title} items={items} fallback={fallback} />
  );
}
