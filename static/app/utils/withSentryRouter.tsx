// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';

import {customerDomain, usingCustomerDomain} from 'sentry/constants';

/**
 * withSentryRouter is a higher-order component (HOC) that wraps withRouter, and implicitly injects the current customer
 * domain as the orgId parameter. This only happens if a customer domain is currently being used.
 *
 * Since withRouter() is discouraged from being used on new React components, we would use withSentryRouter() on
 * pre-existing React components.
 */
function withSentryRouter<P extends WithRouterProps>(
  WrappedComponent: React.ComponentType<P>
) {
  function WithSentryRouterWrapper(props: P) {
    const {params} = props;
    if (usingCustomerDomain) {
      const newParams = {...params, orgId: customerDomain};
      return <WrappedComponent {...props} params={newParams} />;
    }

    return <WrappedComponent {...props} />;
  }
  return withRouter(WithSentryRouterWrapper);
}

export default withSentryRouter;
