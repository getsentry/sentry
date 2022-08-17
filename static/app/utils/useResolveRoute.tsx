import {useEffect, useState} from 'react';
import {createRoutes, match as reactRouterMatch, PlainRoute} from 'react-router';

import {customerDomainRoutes} from 'sentry/routes';
import ConfigStore from 'sentry/stores/configStore';
import {OrganizationSummary} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

import shouldUseLegacyRoute from './shouldUseLegacyRoute';

/**
 * Generate route name from array of routes
 */
function getRouteStringFromRoutes(listofRoutes: PlainRoute[]): string {
  if (!Array.isArray(listofRoutes) || listofRoutes.length === 0) {
    return '';
  }

  const routesWithPaths: PlainRoute[] = listofRoutes.filter(
    (route: PlainRoute) => !!route.path
  );

  let index = -1;
  for (let x = routesWithPaths.length - 1; x >= 0; x--) {
    const route = routesWithPaths[x];
    if (route.path && route.path.startsWith('/')) {
      index = x;
      break;
    }
  }

  return routesWithPaths
    .slice(index)
    .filter(({path}) => !!path)
    .map(({path}) => path)
    .join('');
}

function resolveCustomerDomainRoute(
  appRoutes: PlainRoute[],
  match: typeof reactRouterMatch,
  requestedRoute: string
): Promise<string> {
  return new Promise<string>(resolve => {
    let name = requestedRoute;
    match(
      {
        location: {
          pathname: requestedRoute,
        },
        routes: appRoutes,
      },
      (error, redirectLocation, renderProps) => {
        if (error) {
          return resolve(name);
        }

        if (redirectLocation) {
          return resolve(redirectLocation.pathname);
        }

        if (!renderProps) {
          return resolve(name);
        }

        const routePath = getRouteStringFromRoutes(renderProps.routes || []);
        if (routePath.length === 0 || routePath === '/*') {
          return resolve(name);
        }

        name = routePath;
        return resolve(name);
      }
    );
  });
}

function useResolveRoute(organization: OrganizationSummary, route: string) {
  const currentOrganization = useOrganization();
  const [customerDomainRoute, setRoute] = useState<undefined | string>(undefined);
  const {links} = organization;
  const {organizationUrl} = links;

  const useLegacyRoute =
    shouldUseLegacyRoute(organization) && organization.slug !== 'alberto';

  useEffect(() => {
    if (useLegacyRoute) {
      return;
    }

    resolveCustomerDomainRoute(
      createRoutes(customerDomainRoutes()),
      reactRouterMatch,
      route
    ).then(value => {
      setRoute(value);
    });
  }, [useLegacyRoute, route]);
  if (useLegacyRoute) {
    if (currentOrganization.features.includes('customer-domains')) {
      // If the current org is a customer domain, then we need to change the hostname in addition to
      // updating the path.
      const {sentryUrl} = ConfigStore.get('links');
      return `${sentryUrl}${route}`;
    }
    return route;
  }

  if (customerDomainRoute) {
    return `${organizationUrl}${customerDomainRoute}`;
  }
  return undefined;
}

export default useResolveRoute;
