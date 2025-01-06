import {useMemo} from 'react';
import type {LocationDescriptor} from 'history';

import type {InjectedRouter} from 'sentry/types/legacyReactRouter';

import {useLocation} from './useLocation';
import {useNavigate} from './useNavigate';
import {useParams} from './useParams';
import {useTestRouteContext} from './useRouteContext';
import {useRoutes} from './useRoutes';

/**
 * @deprecated Please do not use this. Use a specific hook instead. Including
 * use{Location,Params,Routes,Navigate}.
 *
 * react-router 6 does not include this hook.
 */
function useRouter(): InjectedRouter<any, any> {
  // When running in test mode we still read from the legacy route context to
  // keep test compatability while we fully migrate to react router 6
  const testRouteContext = useTestRouteContext();

  if (testRouteContext) {
    return testRouteContext.router;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const navigate = useNavigate();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const location = useLocation();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const params = useParams();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const routes = useRoutes();

  // XXX(epurkhiser): We emulate the react-router 3 `router` interface here
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const router = useMemo(
    () =>
      ({
        go: delta => navigate(delta),
        push: path => navigate(path),
        replace: path => navigate(path, {replace: true}),
        goBack: () => navigate(-1),
        goForward: () => navigate(1),
        location,
        params,
        routes,

        // TODO(epurkhiser): These need correct shims
        isActive: (_location: LocationDescriptor, _indexOnly?: boolean) => {
          // eslint-disable-next-line no-console
          console.error('isActive not implemented for react-router 6 migration');
          return false;
        },
        createPath: (_pathOrLoc: LocationDescriptor, _query?: any) => {
          throw new Error('createpath not implemented for react-router 6 migration');
        },
        createHref: (_pathOrLoc: LocationDescriptor, _query?: any) => {
          throw new Error('createHref not implemented for react-router 6 migration');
        },
        setRouteLeaveHook: (_route: any, _callback: any) => () => {
          throw new Error(
            'setRouteLeave hook not implemented for react-router6 migration'
          );
        },
      }) satisfies InjectedRouter,
    [location, navigate, params, routes]
  );

  return router;
}

export default useRouter;
