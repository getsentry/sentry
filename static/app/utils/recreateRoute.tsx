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

// Cache the routes derived from a given `matches` array so that repeated calls
// (e.g. `useRoutes` building the list and `recreateRoute` resolving `to` within
// it) return the *same* route object references. Without this, `recreateRoute`
// would have to fall back to value comparison, which cannot distinguish two
// pathless layout routes that collapse to the same `{path: ''}` shape.
const matchesToRoutesCache = new WeakMap<UIMatch[], PlainRoute[]>();

// XXX(epurkhiser): This transforms react-router 6 style matches back to old
// style react-router 3 route matches.
export function matchesToRoutes(matches: UIMatch[]): PlainRoute[] {
  const cached = matchesToRoutesCache.get(matches);
  if (cached) {
    return cached;
  }

  const routes = matches.map<PlainRoute>(match => {
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

  matchesToRoutesCache.set(matches, routes);
  return routes;
}

// Locate `to` within `routes`. Reference identity is preferred because two
// distinct routes can produce the same shape (pathless layout routes collapse
// to `{path: ''}`), and only identity resolves them to the correct position.
// `matchesToRoutes` is memoized so callers that derive `to` from the same
// `matches` array hit this fast path. Fall back to value comparison so a
// separately-constructed `to` still resolves instead of silently truncating.
function findRouteIndex(to: PlainRoute, routes: PlainRoute[]): number {
  const byReference = routes.indexOf(to);
  if (byReference !== -1) {
    return byReference;
  }

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
      ? findRouteIndex(to, routes) + 1
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
