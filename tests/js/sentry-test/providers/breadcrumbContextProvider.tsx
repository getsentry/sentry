import {InjectedRouter, PlainRoute} from 'react-router';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {RouteContext} from 'sentry/views/routeContext';
import {BreadcrumbProvider} from 'sentry/views/settings/components/settingsBreadcrumb/context';

export function BreadcrumbContextProvider({
  children,
  router = RouterFixture(),
  routes = [],
}: {
  children: React.ReactNode;
  router?: InjectedRouter;
  routes?: PlainRoute[];
}) {
  return (
    <RouteContext.Provider
      value={{
        router,
        location: router.location,
        params: {},
        routes,
      }}
    >
      <BreadcrumbProvider>{children}</BreadcrumbProvider>
    </RouteContext.Provider>
  );
}
