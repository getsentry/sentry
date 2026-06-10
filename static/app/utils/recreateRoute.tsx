import type {UIMatch} from 'react-router-dom';
import type {Location} from 'history';

import type {PlainRoute} from 'sentry/types/legacyReactRouter';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';

type Options =
  | {
      // parameters to replace any route string parameters (e.g. if route is `:orgId`,
      // params should have `{orgId: slug}`
      params: Record<string, string | undefined>;

      /**
       * @deprecated Please use `matches` instead
       */
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

      /**
       * @deprecated Please use `matches` instead
       */
      routes?: never;

      /**
       * The number of routes to pop off of `routes
       * Must be < 0
       *
       * There's no ts type for negative numbers so we are arbitrarily specifying -1-9
       */
      stepBack?: -1 | -2 | -3 | -4 | -5 | -6 | -7 | -8 | -9;
    };

function isUIMatch(item: PlainRoute | UIMatch): item is UIMatch {
  return 'id' in item && 'pathname' in item;
}

function getItemPath(item: PlainRoute | UIMatch): string {
  if (isUIMatch(item)) {
    return (item.handle as Record<string, string> | undefined)?.path ?? '';
  }
  return item.path ?? '';
}

function getItemName(item: PlainRoute | UIMatch): string | undefined {
  if (isUIMatch(item)) {
    return (item.handle as Record<string, string> | undefined)?.name;
  }
  return (item as PlainRoute & {name?: string}).name;
}

/**
 * Find the index of `to` in `items`. Tries reference equality first, then
 * falls back to structural matching by path+name so a PlainRoute from
 * useRoutes() can be found in a UIMatch[] from useMatches() (and vice versa).
 */
function findItemIndex(
  to: PlainRoute | UIMatch,
  items: PlainRoute[] | UIMatch[]
): number {
  const refIdx = (items as unknown[]).indexOf(to);
  if (refIdx !== -1) {
    return refIdx;
  }

  const toPath = getItemPath(to);
  const toName = getItemName(to);
  return (items as Array<PlainRoute | UIMatch>).findIndex(
    item => getItemPath(item) === toPath && getItemName(item) === toName
  );
}

/**
 * Given a route object or a string and a list of routes + params from router, this will attempt to recreate a location string while replacing url params.
 * Can additionally specify the number of routes to move back
 *
 * See tests for examples
 */
export function recreateRoute(
  to: string | PlainRoute | UIMatch,
  options: Options
): string {
  const {params, location, stepBack} = options;

  let paths: string[];
  let toIndex: number | undefined;

  if (options.matches) {
    paths = options.matches.map(match => {
      let path = (match.handle as Record<string, string> | undefined)?.path ?? '';
      if (path.length > 0 && !path.endsWith('/')) {
        path = `${path}/`;
      }
      return path;
    });
    if (typeof to !== 'string') {
      toIndex = findItemIndex(to, options.matches) + 1;
    }
  } else {
    paths = options.routes.map(({path: p}) => {
      let path = p || '';
      if (path.length > 0 && !path.endsWith('/')) {
        path = `${path}/`;
      }
      return path;
    });
    if (typeof to !== 'string') {
      toIndex = findItemIndex(to, options.routes) + 1;
    }
  }

  let lastRootIndex: number;
  if (toIndex === undefined) {
    lastRootIndex = paths.findLastIndex(path => path[0] === '/');
  } else {
    lastRootIndex = paths.slice(0, toIndex).findLastIndex(path => path[0] === '/');
  }

  let baseRoute = paths.slice(lastRootIndex, toIndex);

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
