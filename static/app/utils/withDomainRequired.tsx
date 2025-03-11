import trimEnd from 'lodash/trimEnd';
import trimStart from 'lodash/trimStart';

import ConfigStore from 'sentry/stores/configStore';
import type {RouteComponent, RouteComponentProps} from 'sentry/types/legacyReactRouter';

/**
 * withDomainRequired is a higher-order component (HOC) meant to be used with <Route /> components within
 * static/app/routes.tsx whose route paths do not contain the :orgId parameter.
 * For example:
 *
 *  <Route
 *    path="/issues/(searches/:searchId/)"
 *    component={withDomainRequired(errorHandler(IssueListContainer))}
 *  / >
 *
 * withDomainRequired ensures that the route path is only accessed whenever a customer domain is used.
 * For example: orgslug.sentry.io
 *
 * The side-effect that this HOC provides is that it'll redirect the browser to sentryUrl
 * (from ConfigStore.getState().links) whenever one of the following conditions are not satisfied:
 *
 * - ConfigStore.getState().customerDomain is present.
 * - ConfigStore.getState().features contains system:multi-region feature.
 *
 * If both conditions above are satisfied, then WrappedComponent will be rendered with orgId included in the route
 * params prop.
 *
 * Whenever https://orgslug.sentry.io/ is accessed in the browser, then both conditions above will be satisfied.
 */
export default function withDomainRequired<P extends RouteComponentProps>(
  WrappedComponent: RouteComponent
) {
  return function withDomainRequiredWrapper(props: P) {
    const {params} = props;
    const {features, customerDomain, links} = ConfigStore.getState();
    const {sentryUrl} = links;

    const hasCustomerDomain = features.has('system:multi-region');

    if (!customerDomain || !hasCustomerDomain) {
      // This route should only be accessed if a customer domain is used.
      // We redirect the user to the sentryUrl.
      const redirectPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const redirectURL = `${trimEnd(sentryUrl, '/')}/${trimStart(redirectPath, '/')}`;
      window.location.replace(redirectURL);
      return null;
    }

    const newParams = {
      ...params,
      orgId: customerDomain.subdomain,
    };

    return <WrappedComponent {...props} params={newParams} />;
  };
}
