import {createRoutes, RouteComponent} from 'react-router';

import * as constants from 'sentry/constants';
import {buildRoutes} from 'sentry/routes';

import {normalizeUrl} from './utils/withDomainRequired';

// Setup a module mock so that we can replace
// usingCustomerDomain with a getter.
jest.mock('sentry/constants', () => {
  const originalModule = jest.requireActual('sentry/constants');

  return {
    __esModule: true,
    ...originalModule,
    get usingCustomerDomain() {
      return false;
    },
  };
});

// Workaround react-router PlainRoute type not covering redirect routes.
type RouteShape = {
  childRoutes?: RouteShape[];
  component?: RouteComponent;
  from?: string;
  path?: string;
};

type RouteMetadata = {
  leadingPath: string;
  route: RouteShape;
};

function extractRoutes(rootRoute: any): Record<string, RouteComponent> {
  const routeTree = createRoutes(rootRoute);
  const routeMap: Record<string, RouteComponent> = {};

  // A queue of routes we need to visit
  const visitQueue: RouteMetadata[] = [{leadingPath: '', route: routeTree[0]}];
  while (visitQueue.length > 0) {
    const current = visitQueue.pop();
    if (!current) {
      break;
    }
    let leading = current.leadingPath;
    if (current.route.path?.startsWith('/')) {
      leading = '';
    }

    const currentPath = `${leading}${current.route.path ?? ''}`.replace('//', '/');
    if (current.route.childRoutes) {
      for (const childRoute of current.route.childRoutes ?? []) {
        visitQueue.push({
          leadingPath: currentPath,
          route: childRoute,
        });
      }
    } else {
      if (current.route.from) {
        // Redirect routes are not relevant to us.
        continue;
      }

      // We are on a terminal route in the tree. Add to the map of route components.
      // We are less interested in container route components.
      if (current.route.component) {
        routeMap[currentPath] = current.route.component;
      }
    }
  }

  return routeMap;
}

describe('buildRoutes()', function () {
  // Until customer-domains is mainlined and path
  // based slug routes are removed we need to ensure
  // that each orgId route also has slugless path.
  test('orgId routes also have domain routes', function () {
    const spy = jest.spyOn(constants, 'usingCustomerDomain', 'get');

    // Get routes for with customer domains off.
    spy.mockReturnValue(false);
    const routeMap = extractRoutes(buildRoutes());

    // Get routes with customer domains on.
    spy.mockReturnValue(true);
    const domainRoutes = extractRoutes(buildRoutes());

    // All routes that exist under orgId path slugs should
    // have a sibling under customer-domains.
    const mismatch: Array<{domain: string; slug: string}> = [];
    for (const path in routeMap) {
      // Normalize the URLs so that we know the path we're looking for.
      const domainPath = normalizeUrl(path, {forceCustomerDomain: true});

      // Path is not different under customer domains.
      if (domainPath === path) {
        continue;
      }

      if (!domainRoutes[domainPath]) {
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
