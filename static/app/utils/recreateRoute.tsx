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
      toIndex = options.matches.indexOf(to as UIMatch) + 1;
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
      toIndex = options.routes.indexOf(to as PlainRoute) + 1;
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
