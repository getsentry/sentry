import type {UIMatch} from 'react-router-dom';

import type {PlainRoute} from 'sentry/types/legacyReactRouter';

type RouteWithPath = Omit<PlainRoute, 'path'> & Required<Pick<PlainRoute, 'path'>>;

type Props =
  | {
      matches?: never;
      routes?: PlainRoute[];
    }
  | {
      matches?: Array<UIMatch<unknown, unknown>>;
      routes?: never;
    };

/**
 * Creates a route string from an array of `routes` from react-router
 *
 * It will look for the last route path that begins with a `/` and
 * concatenate all of the following routes. Skips any routes without a path
 *
 * @param params.matches An array of UIMatch objects from react-router-dom `useMatches()`
 * @returns A route path string
 */
export function getRouteStringFromRoutes({routes, matches}: Props): string {
  if (matches) {
    // Route patterns are stored in handle.path by useRoutes (not in pathname,
    // which is the resolved URL with params filled in).
    const paths = matches
      .map(match => (match.handle as any)?.path ?? '')
      .filter((path): path is string => !!path);

    const lastAbsolutePathIndex = paths.findLastIndex(path => path.startsWith('/'));

    return paths.slice(lastAbsolutePathIndex).join('');
  }

  if (!Array.isArray(routes)) {
    return '';
  }

  const routesWithPaths = routes.filter((route): route is RouteWithPath => !!route.path);

  const lastAbsolutePathIndex = routesWithPaths.findLastIndex(({path}: any) =>
    path.startsWith('/')
  );

  return routesWithPaths
    .slice(lastAbsolutePathIndex)
    .filter(({path}) => !!path)
    .map(({path}) => path)
    .join('');
}
