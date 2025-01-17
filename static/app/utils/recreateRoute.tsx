import type {Location} from 'history';

import type {PlainRoute} from 'sentry/types/legacyReactRouter';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';

type Options = {
  // parameters to replace any route string parameters (e.g. if route is `:orgId`,
  // params should have `{orgId: slug}`
  params: {[key: string]: string | undefined};

  routes: PlainRoute[];

  location?: Location;
  /**
   * The number of routes to to pop off of `routes
   * Must be < 0
   *
   * There's no ts type for negative numbers so we are arbitrarily specifying -1-9
   */
  stepBack?: -1 | -2 | -3 | -4 | -5 | -6 | -7 | -8 | -9;
};

/**
 * Given a route object or a string and a list of routes + params from router, this will attempt to recreate a location string while replacing url params.
 * Can additionally specify the number of routes to move back
 *
 * See tests for examples
 */
export default function recreateRoute(to: string | PlainRoute, options: Options): string {
  const {routes, params, location, stepBack} = options;
  const paths = routes.map(({path}) => {
    path = path || '';
    if (path.length > 0 && !path.endsWith('/')) {
      path = `${path}/`;
    }
    return path;
  });
  let lastRootIndex: number;
  let routeIndex: number | undefined;

  // TODO(ts): typescript things
  if (typeof to !== 'string') {
    routeIndex = routes.indexOf(to) + 1;
    lastRootIndex = paths
      .slice(0, routeIndex)
      .findLastIndex((path: any) => path[0] === '/');
  } else {
    lastRootIndex = paths.findLastIndex((path: any) => path[0] === '/');
  }

  let baseRoute = paths.slice(lastRootIndex, routeIndex);

  if (typeof stepBack !== 'undefined') {
    baseRoute = baseRoute.slice(0, stepBack);
  }

  const search = location?.search ?? '';
  const hash = location?.hash ?? '';

  const fullRoute = `${baseRoute.join('')}${
    typeof to !== 'string' ? '' : to
  }${search}${hash}`;

  return replaceRouterParams(fullRoute, params);
}
