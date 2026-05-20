import {useMemo} from 'react';

import {CUSTOMER_DOMAIN, USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import type {InjectedRouter, WithRouterProps} from 'sentry/types/legacyReactRouter';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';

/**
 * withSentryRouter is a higher-order component (HOC) that emulates withRouter,
 * and implicitly injects the current customer domain as the orgId parameter.
 * This only happens if a customer domain is currently being used.
 *
 * @deprecated only use in legacy react class components
 */
export function withSentryRouter<P extends Partial<WithRouterProps>>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<Omit<P, keyof WithRouterProps>> {
  function WithSentryRouterWrapper(props: Omit<P, keyof WithRouterProps>) {
    const location = useLocation();
    const params = useParams();
    const routes = useRoutes();
    const navigate = useNavigate();

    // The legacy class components wrapped by this HOC still consume the
    // react-router 3 `InjectedRouter` interface. Build a minimal shim until
    // they're migrated off it.
    const router = useMemo<InjectedRouter>(
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
          isActive: () => false,
        }) as InjectedRouter,
      [location, navigate, params, routes]
    );

    const routerParam: WithRouterProps<P> = {
      location,
      params: params as any,
      router: router as unknown as InjectedRouter<P>,
      routes,
    };

    if (USING_CUSTOMER_DOMAIN) {
      const newParams = {...params, orgId: CUSTOMER_DOMAIN};
      // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
      return <WrappedComponent {...routerParam} {...(props as any)} params={newParams} />;
    }

    // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
    return <WrappedComponent {...routerParam} {...(props as any)} />;
  }
  return WithSentryRouterWrapper;
}
