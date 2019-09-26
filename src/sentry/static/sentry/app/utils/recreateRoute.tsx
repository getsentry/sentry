import {Location} from 'history';
import {PlainRoute} from 'react-router';
import {findLastIndex} from 'lodash';

import replaceRouterParams from 'app/utils/replaceRouterParams';

type Options = {
  routes: Array<PlainRoute>;
  location: Location;
  params: any;

  /**
   * The number of routes to to pop off of `routes
   * Must be < 0
   */
  stepBack?: number;
};

/**
 * Given a route object or a string and a list of routes + params from router, this will attempt to recreate a location string while replacing url params.
 * Can additionally specify the number of routes to move back
 *
 * See tests for examples
 */
// export default function recreateRoute(to: string | PlainRoute, options: Options): string {
export default function recreateRoute(to, {routes, params, location, stepBack}) {
  // const {routes, params, location, stepBack} = options;
  const paths = routes.map(({path}) => path || '');
  let lastRootIndex: number;
  let routeIndex: number | undefined;
  const routeToRoute = typeof to !== 'string';

  // TODO(ts): typescript things
  if (routeToRoute) {
    routeIndex = routes.indexOf(to) + 1;
    lastRootIndex = findLastIndex(paths.slice(0, routeIndex), path => path[0] === '/');
  } else {
    lastRootIndex = findLastIndex(paths, path => path[0] === '/');
  }

  let baseRoute = paths.slice(lastRootIndex, routeIndex);

  if (stepBack >= 0) {
    throw new Error('`stepBack` needs to be < 0');
  } else if (typeof stepBack !== 'undefined') {
    baseRoute = baseRoute.slice(0, stepBack);
  }

  const query = typeof location !== 'undefined' && location.search ? location.search : '';

  const fullRoute = `${baseRoute.join('')}${routeToRoute ? '' : to}${query}`;

  return replaceRouterParams(fullRoute, params);
}
