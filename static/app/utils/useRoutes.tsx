import {useMemo} from 'react';
import {useMatches} from 'react-router-dom';

import type {PlainRoute} from 'sentry/types/legacyReactRouter';

import {useTestRouteContext} from './useRouteContext';

export function useRoutes(): Array<PlainRoute<any>> {
  // When running in test mode we still read from the legacy route context to
  // keep test compatability while we fully migrate to react router 6
  const testRouteContext = useTestRouteContext();

  if (testRouteContext) {
    return testRouteContext.routes;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const matches = useMatches();

  // XXX(epurkhiser): This transforms react-router 6 style matches back to old
  // style react-router 3 rroute matches.
  //
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useMemo(
    () =>
      matches.map<PlainRoute>(match => {
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
      }, []),
    [matches]
  );
}
