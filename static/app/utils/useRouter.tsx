import {useRouteContext} from 'sentry/utils/useRouteContext';

function useRouter() {
  const route = useRouteContext();
  return route.router;
}

export default useRouter;
