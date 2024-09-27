import {CUSTOMER_DOMAIN, USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';

import useRouter from './useRouter';

/**
 * withSentryRouter is a higher-order component (HOC) that emulates withRouter,
 * and implicitly injects the current customer domain as the orgId parameter.
 * This only happens if a customer domain is currently being used.
 *
 * @deprecated only use in legacy react class components
 */
function withSentryRouter<P extends WithRouterProps>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<Omit<P, keyof WithRouterProps>> {
  function WithSentryRouterWrapper(props: Omit<P, keyof WithRouterProps>) {
    const router = useRouter();
    const {location, params, routes} = router;

    const routerParam: WithRouterProps<P> = {
      location,
      params,
      router,
      routes,
    };

    if (USING_CUSTOMER_DOMAIN) {
      const newParams = {...params, orgId: CUSTOMER_DOMAIN};
      return <WrappedComponent {...routerParam} {...(props as P)} params={newParams} />;
    }

    return <WrappedComponent {...routerParam} {...(props as P)} />;
  }
  return WithSentryRouterWrapper;
}

export default withSentryRouter;
