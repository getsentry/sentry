import {PlainRoute} from 'react-router/lib/Route';
import findLastIndex from 'lodash/findLastIndex';

type RouteWithPath = Omit<PlainRoute, 'path'> & Required<Pick<PlainRoute, 'path'>>;

/**
 * Creates a route string from an array of `routes` from react-router
 *
 * It will look for the last route path that begins with a `/` and
 * concatenate all of the following routes. Skips any routes without a path
 *
 * @param {Array<{}>} routes An array of route objects from react-router
 * @return String Returns a route path
 */
export default function getRouteStringFromRoutes(routes?: PlainRoute[]): string {
  if (!Array.isArray(routes)) {
    return '';
  }

  const routesWithPaths = routes.filter((route): route is RouteWithPath => !!route.path);

  const lastAbsolutePathIndex = findLastIndex(routesWithPaths, ({path}) =>
    path.startsWith('/')
  );

  return routesWithPaths
    .slice(lastAbsolutePathIndex)
    .filter(({path}) => !!path)
    .map(({path}) => path)
    .join('');
}
