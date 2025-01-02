import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {RouterFixture} from 'sentry-fixture/routerFixture';

export function RouteComponentPropsFixture<
  QueryParams extends {[key: string]: string | undefined},
  RouteParams extends {[key: string]: string | undefined},
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
