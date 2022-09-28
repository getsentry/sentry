import {PlainRoute} from 'react-router';

/**
 * For all routes with a `path`, find the first route without a route param (e.g. :apiKey)
 *
 * @param routes A list of react-router route objects
 * @param route If given, will only take into account routes between `route` and end of the routes list
 * @return Object Returns a react-router route object
 */
export default function findFirstRouteWithoutRouteParam(
  routes: PlainRoute[],
  route?: PlainRoute
) {
  const routeIndex = route !== undefined ? routes.indexOf(route) : -1;
  const routesToSearch = route && routeIndex > -1 ? routes.slice(routeIndex) : routes;

  return (
    routesToSearch.filter(({path}) => !!path).find(({path}) => !path?.includes(':')) ||
    route
  );
}
