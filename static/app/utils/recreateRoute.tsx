import type {UIMatch} from 'react-router-dom';
import type {Location} from 'history';

import type {PlainRoute} from 'sentry/types/legacyReactRouter';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';

type Options =
  | {
      // parameters to replace any route string parameters (e.g. if route is `:orgId`,
      // params should have `{orgId: slug}`
      params: Record<string, string | undefined>;
      routes: PlainRoute[];
      location?: Location;

      matches?: never;
      /**
       * The number of routes to pop off of `routes
       * Must be < 0
       *
       * There's no ts type for negative numbers so we are arbitrarily specifying -1-9
       */
      stepBack?: -1 | -2 | -3 | -4 | -5 | -6 | -7 | -8 | -9;
    }
  | {
      matches: UIMatch[];
      // parameters to replace any route string parameters (e.g. if route is `:orgId`,
      // params should have `{orgId: slug}`
      params: Record<string, string | undefined>;
      location?: Location;

      routes?: never;
      /**
       * The number of routes to pop off of `routes
       * Must be < 0
       *
       * There's no ts type for negative numbers so we are arbitrarily specifying -1-9
       */
      stepBack?: -1 | -2 | -3 | -4 | -5 | -6 | -7 | -8 | -9;
    };

export function matchesToRoutes(matches: UIMatch[]): PlainRoute[] {
  return matches.map(m => ({...(m.handle as any)}));
}

function findRouteInMatches(to: PlainRoute, matches: UIMatch[]): number {
  return matches.findIndex(m => {
    const handle = m.handle;
    if (!handle || typeof handle !== 'object') {
      return false;
    }
    const toKeys = Object.keys(to);
    const handleKeys = Object.keys(handle);
    if (toKeys.length !== handleKeys.length) {
      return false;
    }
    return toKeys.every(k => (to as any)[k] === (handle as any)[k]);
  });
}

/**
 * Given a route object or a string and a list of routes + params from router, this will attempt to recreate a location string while replacing url params.
 * Can additionally specify the number of routes to move back
 *
 * See tests for examples
 */
export function recreateRoute(to: string | PlainRoute, options: Options): string {
  const {params, location, stepBack} = options;
  const routes = options.matches ? matchesToRoutes(options.matches) : options.routes;
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
  if (typeof to === 'string') {
    lastRootIndex = paths.findLastIndex((path: any) => path[0] === '/');
  } else {
    routeIndex = options.matches
      ? findRouteInMatches(to, options.matches) + 1
      : routes.indexOf(to) + 1;
    lastRootIndex = paths
      .slice(0, routeIndex)
      .findLastIndex((path: any) => path[0] === '/');
  }

  let baseRoute = paths.slice(lastRootIndex, routeIndex);

  if (stepBack !== undefined) {
    baseRoute = baseRoute.slice(0, stepBack);
  }

  const search = location?.search ?? '';
  const hash = location?.hash ?? '';

  const fullRoute = `${baseRoute.join('')}${
    typeof to === 'string' ? to : ''
  }${search}${hash}`;

  return replaceRouterParams(fullRoute, params);
}
