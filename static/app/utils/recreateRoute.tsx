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

// XXX(epurkhiser): This transforms react-router 6 style matches back to old
// style react-router 3 route matches.
export function matchesToRoutes(matches: UIMatch[]): PlainRoute[] {
  return matches.map<PlainRoute>(match => {
    // We put things like `name` (for breadcrumbs) in the handle. Extract
    // it out here
    const extra: any = match.handle;

    // In react-router 6 the match returns a `pathname`, but the route is
    // resolved, so it does not include the parameter slug (like
    // `:issueId`) and has the prefixing route, so if the route part is
    // just `:issueId`, but is nested under `/issues/` it will be
    // `/issues/:issueId`, which is not what react-router 3 did.
    //
    // To shim for this, we are storing the unresolved `path` of the route
    // in the user-data `handle` object, so we can just extract it from
    // there
    const path: string = extra?.path ?? '';

    return {path, ...extra};
  }, []);
}

// `to` and the entries of `routes` are both produced by `matchesToRoutes`, so
// they share the same shape (including the synthesized `path` key) and preserve
// nested references via the shallow spread. Match by value here rather than by
// object identity because `recreateRoute` rebuilds `routes` on every call, so
// the caller's `to` is never reference-equal to the local `routes` entries.
function findRouteInRoutes(to: PlainRoute, routes: PlainRoute[]): number {
  return routes.findIndex(route => {
    const toKeys = Object.keys(to);
    const routeKeys = Object.keys(route);
    if (toKeys.length !== routeKeys.length) {
      return false;
    }
    return toKeys.every(k => (to as any)[k] === (route as any)[k]);
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
      ? findRouteInRoutes(to, routes) + 1
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
