import {useMemo} from 'react';
import type {LocationDescriptor} from 'history';

import type {InjectedRouter} from 'sentry/types/legacyReactRouter';

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
export function useRouter(): InjectedRouter<any, any> {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const routes = useRoutes();

  // XXX(epurkhiser): We emulate the react-router 3 `router` interface here
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
      }) satisfies InjectedRouter,
    [location, navigate, params, routes]
  );

  return router;
}
