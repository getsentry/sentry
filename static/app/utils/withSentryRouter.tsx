// eslint-disable-next-line no-restricted-imports
import type {WithRouterProps} from 'react-router';
// eslint-disable-next-line no-restricted-imports
import {withRouter} from 'react-router';

import {CUSTOMER_DOMAIN, USING_CUSTOMER_DOMAIN} from 'sentry/constants';

/**
 * withSentryRouter is a higher-order component (HOC) that wraps withRouter, and implicitly injects the current customer
 * domain as the orgId parameter. This only happens if a customer domain is currently being used.
 *
 * Since withRouter() is discouraged from being used on new React components, we would use withSentryRouter() on
 * pre-existing React components.
 */
function withSentryRouter<P extends WithRouterProps>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<Omit<P, keyof WithRouterProps>> {
  function WithSentryRouterWrapper(props: P) {
    const {params} = props;
    if (USING_CUSTOMER_DOMAIN) {
      const newParams = {...params, orgId: CUSTOMER_DOMAIN};
      return <WrappedComponent {...props} params={newParams} />;
    }

    return <WrappedComponent {...props} />;
  }
  return withRouter(WithSentryRouterWrapper);
}

export default withSentryRouter;
