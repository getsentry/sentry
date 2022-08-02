import {useRouteContext} from 'sentry/utils/useRouteContext';

export function useRoutes() {
  const route = useRouteContext();
  return route.routes;
}
