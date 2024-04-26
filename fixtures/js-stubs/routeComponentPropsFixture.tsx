import type {RouteComponentProps} from 'react-router';
import {RouterFixture} from 'sentry-fixture/routerFixture';

export function RouteComponentPropsFixture<
  QueryParams = {orgId: string; projectId: string},
  RouteParams = {},
>(
  params: Partial<RouteComponentProps<QueryParams, RouteParams>> = {}
): RouteComponentProps<QueryParams, RouteParams> {
  const router = RouterFixture(params);
  return {
    location: router.location,
    params: router.params as QueryParams & RouteParams,
    routes: router.routes,
    route: router.routes[0],
    routeParams: router.params as RouteParams,
    router,
  };
}
