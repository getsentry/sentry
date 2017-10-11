import {findLastIndex} from 'lodash';

import replaceRouterParams from './replaceRouterParams';

export default function recreateRoute(to, {routes, params, stepBack}) {
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

  let fullRoute = `${baseRoute.join('')}${routeToRoute ? '' : to}`;

  return replaceRouterParams(fullRoute, params);
}
