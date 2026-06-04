import {RouterFixture} from 'sentry-fixture/routerFixture';

import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

export function RouteComponentPropsFixture<
  QueryParams extends Record<string, string | undefined>,
  RouteParams extends Record<string, string | undefined>,
>(
  params: Partial<RouteComponentProps<QueryParams, RouteParams>> = {}
): RouteComponentProps<QueryParams, RouteParams> {
  const router = RouterFixture(params);
  return {
    location: router.location,
    params: router.params as QueryParams & RouteParams,
    routes: router.routes,
    route: router.routes[0]!,
    routeParams: router.params as RouteParams,
    router,
  };
}
