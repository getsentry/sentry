import {useRouteContext} from 'sentry/utils/useRouteContext';

export function useParams() {
  const route = useRouteContext();
  return route.params;
}
