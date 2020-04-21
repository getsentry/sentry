import {Location} from 'history';
import {PlainRoute} from 'react-router/lib/Route';
import findLastIndex from 'lodash/findLastIndex';

import replaceRouterParams from 'app/utils/replaceRouterParams';

type Options = {
  routes: PlainRoute[];
  location: Location;

  // parameters to replace any route string parameters (e.g. if route is `:orgId`,
  // params should have `{orgId: slug}`
  params: {[key: string]: string | undefined};

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
  const paths = routes.map(({path}) => path || '');
  let lastRootIndex: number;
  let routeIndex: number | undefined;

  // TODO(ts): typescript things
  if (typeof to !== 'string') {
    routeIndex = routes.indexOf(to) + 1;
    lastRootIndex = findLastIndex(paths.slice(0, routeIndex), path => path[0] === '/');
  } else {
    lastRootIndex = findLastIndex(paths, path => path[0] === '/');
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
