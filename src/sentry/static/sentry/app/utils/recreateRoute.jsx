import {findLastIndex} from 'lodash';

import replaceRouterParams from 'app/utils/replaceRouterParams';

// Given a route object or a string and a list of routes + params from router, this will attempt to
// recreate a location string while replacing url params.
//
// Can additionally specify the number of routes to move back
//
// See tests for examples
export default function recreateRoute(to, {routes, params, location, stepBack}) {
  let paths = routes.map(({path}) => path || '');
  let lastRootIndex = findLastIndex(paths, path => path[0] === '/');
  let routeIndex;
  let routeToRoute = typeof to !== 'string';
  if (routeToRoute) {
    routeIndex = routes.indexOf(to) + lastRootIndex;
  }

  let baseRoute = paths.slice(lastRootIndex, routeIndex);

  if (typeof stepBack !== 'undefined') {
    baseRoute = baseRoute.slice(0, stepBack);
  }

  let query = typeof location !== 'undefined' && location.search ? location.search : '';

  let fullRoute = `${baseRoute.join('')}${routeToRoute ? '' : to}${query}`;

  return replaceRouterParams(fullRoute, params);
}
