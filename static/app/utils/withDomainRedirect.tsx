import {useContext} from 'react';
import {formatPattern, RouteComponent, RouteComponentProps} from 'react-router';
import * as Sentry from '@sentry/react';
import trimEnd from 'lodash/trimEnd';
import trimStart from 'lodash/trimStart';

import recreateRoute from 'sentry/utils/recreateRoute';
import Redirect from 'sentry/utils/redirect';
import {OrganizationContext} from 'sentry/views/organizationContext';

type WithDomainRedirectOptions = {
  redirect: Array<{from: string; to: string}>;
};

/**
 * withDomainRedirect is a higher-order component (HOC) meant to be used with <Route /> components within
 * static/app/routes.tsx whose route paths contains the :orgId parameter at least once.
 * For example:
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
  WrappedComponent: RouteComponent,
  options?: WithDomainRedirectOptions
) {
  return function WithDomainRedirectWrapper(props: P) {
    const {customerDomain, links} = window.__initialData;
    const {sentryUrl} = links;
    const currentOrganization = useContext(OrganizationContext);

    if (customerDomain) {
      // Customer domain is being used on a route that has an :orgId parameter.
      const redirectPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const redirectURL = `${trimEnd(sentryUrl, '/')}/${trimStart(redirectPath, '/')}`;

      if (currentOrganization) {
        if (
          currentOrganization.slug !== customerDomain.subdomain ||
          !currentOrganization.features.includes('customer-domains')
        ) {
          window.location.replace(redirectURL);
          return null;
        }
      }

      const {params, routes} = props;

      // Regenerate the full route with the :orgId parameter omitted.
      const newParams = {...params};
      Object.keys(params).forEach(param => {
        newParams[param] = `:${param}`;
      });
      const fullRoute = recreateRoute('', {routes, params: newParams});
      let orglessSlugRoute = fullRoute
        .replace(/organizations\/:orgId\/?/, '')
        .replace(/:orgId\/?/, '');

      if (orglessSlugRoute === fullRoute) {
        // :orgId is not present in the route, so we do not need to perform a redirect here.
        return <WrappedComponent {...props} />;
      }

      if (options && options.redirect) {
        const result = options.redirect.find(needle => fullRoute.startsWith(needle.from));
        if (result) {
          const rest = fullRoute.slice(result.from.length);
          orglessSlugRoute = `${result.to}${rest}`;
        }
      }

      const orglessRedirectPath = formatPattern(orglessSlugRoute, params);
      const redirectOrgURL = `/${trimStart(orglessRedirectPath, '/')}${
        window.location.search
      }${window.location.hash}`;

      const paramOrgId = (params as any).orgId ?? '';

      Sentry.withScope(function (scope) {
        const wrongOrgId = paramOrgId !== customerDomain.subdomain ? 'yes' : 'no';
        scope.setTag('isCustomerDomain', 'yes');
        scope.setTag('customerDomain.organizationUrl', customerDomain.organizationUrl);
        scope.setTag('customerDomain.sentryUrl', customerDomain.sentryUrl);
        scope.setTag('customerDomain.subdomain', customerDomain.subdomain);
        scope.setTag('customerDomain.fromRoute', fullRoute);
        scope.setTag('customerDomain.redirectRoute', orglessSlugRoute);
        scope.setTag('customerDomain.wrongOrgId', wrongOrgId);
        scope.setTag('customerDomain.paramOrgId', paramOrgId);
        scope.setContext('customerDomain', {
          customerDomain,
          fullRoute,
          orglessSlugRoute,
          redirectOrgURL,
          routeParams: params,
        });
        Sentry.captureMessage('Redirect with :orgId param on customer domain');
      });

      // Redirect to a route path with :orgId omitted.
      return <Redirect to={redirectOrgURL} router={props.router} />;
    }

    return <WrappedComponent {...props} />;
  };
}

export default withDomainRedirect;
