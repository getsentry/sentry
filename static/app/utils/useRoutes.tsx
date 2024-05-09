import {useMemo} from 'react';
import type {PlainRoute} from 'react-router';
import {useMatches} from 'react-router-dom';

import {USING_REACT_ROUTER_SIX} from 'sentry/constants';
import {useRouteContext} from 'sentry/utils/useRouteContext';

export function useRoutes() {
  if (!USING_REACT_ROUTER_SIX) {
    // biome-ignore lint/correctness/useHookAtTopLevel: react-router-6 migration
    return useRouteContext().routes;
  }

  // biome-ignore lint/correctness/useHookAtTopLevel: react-router-6 migration
  const matches = useMatches();

  // XXX(epurkhiser): This transforms react-router 6 style matches back to old
  // style react-router 3 rroute matches.
  //
  // biome-ignore lint/correctness/useHookAtTopLevel: react-router-6 migration
  return useMemo(
    () =>
      matches.reduce<PlainRoute[]>((acc, match) => {
        const currentPrefix = acc.map(route => route.path ?? '').join('');

        // In react-router 6 each pathname is the full matching path. In
        // react-router 3 each match object just has the matching part. We can
        // reconstruct this by removing the prefix from the previous routes as
        // we build them
        let path = match.pathname.slice(currentPrefix.length);

        // XXX: Another difference we have to account for is trailing slashes.
        // I'm not 100% sure why but react-router 6 seems to trim slashes.
        // Let's ensure if we have a route that it ends with a slash
        if (path !== '' && !path.endsWith('/')) {
          path = `${path}/`;
        }

        // We put things like `name` (for breadcrumbs) in the handle. Extract
        // it out here
        const extra: any = match.handle;

        return [...acc, {path, ...extra}];
      }, []),
    [matches]
  );
}
