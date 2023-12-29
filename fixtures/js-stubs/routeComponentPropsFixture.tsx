import type {RouteComponentProps} from 'react-router';
import {RouterFixture} from 'sentry-fixture/routerFixture';

export function RouteComponentPropsFixture<
  RouteParams = {orgId: string; projectId: string},
>(
  params: Partial<RouteComponentProps<RouteParams, {}>> = {}
): RouteComponentProps<RouteParams, {}> {
  const router = RouterFixture(params);
  return {
    location: router.location,
    params: router.params as RouteParams & {},
    routes: router.routes,
    route: router.routes[0],
    routeParams: router.params,
    router,
  };
}

// TODO(epurkhiser): Remove once removed from getsentry
export default RouteComponentPropsFixture;
