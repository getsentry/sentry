import {useMemo} from 'react';
import type {RouteHook} from 'react-router/lib/Router';
import type {LocationDescriptor} from 'history';

import {NODE_ENV} from 'sentry/constants';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import {useRouteContext} from 'sentry/utils/useRouteContext';

import {useLocation} from './useLocation';
import {useNavigate} from './useNavigate';
import {useParams} from './useParams';
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
  const useReactRouter6 = window.__SENTRY_USING_REACT_ROUTER_SIX && NODE_ENV !== 'test';

  if (!useReactRouter6) {
    // biome-ignore lint/correctness/useHookAtTopLevel: react-router 6 migration
    return useRouteContext().router;
  }

  // biome-ignore lint/correctness/useHookAtTopLevel: react-router 6 migration
  const navigate = useNavigate();
  // biome-ignore lint/correctness/useHookAtTopLevel: react-router 6 migration
  const location = useLocation();
  // biome-ignore lint/correctness/useHookAtTopLevel: react-router 6 migration
  const params = useParams();
  // biome-ignore lint/correctness/useHookAtTopLevel: react-router 6 migration
  const routes = useRoutes();

  // XXX(epurkhiser): We emulate the react-router 3 `router` interface here
  // biome-ignore lint/correctness/useHookAtTopLevel: react-router 6 migration
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
        setRouteLeaveHook: (_route: any, _callback: RouteHook) => () => {
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
