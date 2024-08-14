import {useRouteContext} from 'sentry/utils/useRouteContext';

/**
 * @deprecated Please do not use this. Use a specific hook instead. Including
 * use{Location,Params,Routes,Navigate}.
 *
 * react-router 6 does not include this hook.
 */
function useRouter() {
  const route = useRouteContext();
  return route.router;
}

export default useRouter;
