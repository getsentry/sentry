import {formatPattern, RouteComponent, RouteComponentProps} from 'react-router';
import trimEnd from 'lodash/trimEnd';
import trimStart from 'lodash/trimStart';

import recreateRoute from 'sentry/utils/recreateRoute';
import Redirect from 'sentry/utils/redirect';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import useOrganization from './useOrganization';

/**
 * withDomainRedirect is a higher-order component (HOC) meant to be used with <Route /> components within
 * static/app/routes.tsx whose route paths contains the :orgId parameter at least once.
 * For example:
 *
 *  <Route
 *    path="/organizations/:orgId/issues/(searches/:searchId/)"
 *    component={withDomainRedirect(errorHandler(IssueListContainer))}
 *  / >
 *
 * withDomainRedirect checks if the associated route path is accessed within a customer domain (e.g. orgslug.sentry.io),
 * then redirect the browser to a route path with /organization/:orgId/ and /:orgId/ omitted (in that order).
 * For example, redirect /organizations/:orgId/issues/(searches/:searchId/) to /issues/(searches/:searchId/)
 *
 * If a redirect should occur, then a Sentry event will be emitted.
 *
 * If either a customer domain is not being used, or if :orgId is not present in the route path, then WrappedComponent
 * is rendered.
 */
function withDomainRedirect<P extends RouteComponentProps<{}, {}>>(
  WrappedComponent: RouteComponent
) {
  return function WithDomainRedirectWrapper(props: P) {
    const {customerDomain, links} = window.__initialData;
    const {sentryUrl} = links;
    const currentOrganization = useOrganization({allowNull: true});

    if (customerDomain) {
      // Customer domain is being used on a route that has an :orgId parameter.
      const redirectPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const redirectURL = `${trimEnd(sentryUrl, '/')}/${trimStart(redirectPath, '/')}`;

      // If we have domain information, but the subdomain and slug are different
      // redirect to the slug path and let django decide what happens next.
      if (
        currentOrganization &&
        customerDomain.subdomain &&
        (currentOrganization.slug !== customerDomain.subdomain ||
          !currentOrganization.features.includes('customer-domains'))
      ) {
        window.location.replace(redirectURL);
        return null;
      }

      const {params, routes} = props;

      // Regenerate the full route with the :orgId parameter omitted.
      const newParams = {...params};
      Object.keys(params).forEach(param => {
        newParams[param] = `:${param}`;
      });
      const fullRoute = recreateRoute('', {routes, params: newParams});
      const orglessSlugRoute = normalizeUrl(fullRoute, {forceCustomerDomain: true});

      if (orglessSlugRoute === fullRoute) {
        // :orgId is not present in the route, so we do not need to perform a redirect here.
        return <WrappedComponent {...props} />;
      }

      const orglessRedirectPath = formatPattern(orglessSlugRoute, params);
      const redirectOrgURL = `/${trimStart(orglessRedirectPath, '/')}${
        window.location.search
      }${window.location.hash}`;

      // Redirect to a route path with :orgId omitted.
      return <Redirect to={redirectOrgURL} router={props.router} />;
    }

    return <WrappedComponent {...props} />;
  };
}

export default withDomainRedirect;
