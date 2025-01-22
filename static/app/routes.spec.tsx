import type {RouteObject} from 'react-router-dom';

import * as constants from 'sentry/constants';
import {buildRoutes} from 'sentry/routes';
import {buildReactRouter6Routes} from 'sentry/utils/reactRouter6Compat/router';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

// Setup a module mock so that we can replace
// USING_CUSTOMER_DOMAIN with a getter.
jest.mock('sentry/constants', () => {
  const originalModule = jest.requireActual('sentry/constants');

  return {
    __esModule: true,
    ...originalModule,
    get USING_CUSTOMER_DOMAIN() {
      return false;
    },
  };
});

type RouteMetadata = {
  leadingPath: string;
  route: RouteObject;
};

function extractRoutes(rootRoute: RouteObject[]): Set<string> {
  const routes = new Set<string>();

  // A queue of routes we need to visit
  const visitQueue: RouteMetadata[] = [{leadingPath: '', route: rootRoute[0]!}];
  while (visitQueue.length > 0) {
    const current = visitQueue.pop();
    if (!current) {
      break;
    }
    const leading = current.leadingPath;

    const currentPath = `${leading}${current.route.path ?? ''}`.replace('//', '/');
    if (current.route.children) {
      for (const childRoute of current.route.children ?? []) {
        visitQueue.push({
          leadingPath: currentPath,
          route: childRoute,
        });
      }
    }

    if (
      current.route.element &&
      (
        current.route.element as React.ReactElement<any, React.NamedExoticComponent>
      ).type.displayName?.endsWith('Redirect')
    ) {
      // Redirect routes are not relevant to us.
      continue;
    }

    // We are on a terminal route in the tree. Add to the map of route components.
    // We are less interested in container route components.
    if (current.route.element) {
      routes.add(currentPath);
    }
  }

  return routes;
}

describe('buildRoutes()', function () {
  // Until customer-domains is enabled for single-tenant, self-hosted and path
  // based slug routes are removed we need to ensure
  // that each orgId route also has slugless path.
  test('orgId routes also have domain routes', function () {
    const spy = jest.spyOn(constants, 'USING_CUSTOMER_DOMAIN', 'get');

    // Get routes for with customer domains off.
    spy.mockReturnValue(false);
    const routes = extractRoutes(buildReactRouter6Routes(buildRoutes()));

    // Get routes with customer domains on.
    spy.mockReturnValue(true);
    const domainRoutes = extractRoutes(buildReactRouter6Routes(buildRoutes()));

    // All routes that exist under orgId path slugs should
    // have a sibling under customer-domains.
    const mismatch: {domain: string; slug: string}[] = [];
    for (const path of routes) {
      // Normalize the URLs so that we know the path we're looking for.
      const domainPath = normalizeUrl(path, {forceCustomerDomain: true});

      // Path is not different under customer domains.
      if (domainPath === path) {
        continue;
      }

      if (!domainRoutes.has(domainPath)) {
        mismatch.push({slug: path, domain: domainPath});
      }
    }

    if (mismatch.length > 0) {
      const routelist = mismatch
        .map(item => `- slug: ${item.slug}\n  domain: ${item.domain}`)
        .join('\n');
      throw new Error(
        `Unable to find matching URLs for the following ${mismatch.length} routes:\n\n` +
          routelist +
          '\n\nEach route with the :orgId parameter is expected to have corresponding domain based route as well. ' +
          'If you need help with this drop by #proj-hybrid-cloud.'
      );
    }
  });
});
