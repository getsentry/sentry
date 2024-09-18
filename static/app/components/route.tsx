// biome-ignore lint/nursery/noRestrictedImports: Will be removed with react router 6
import type {IndexRouteProps, PlainRoute, RouteProps} from 'react-router';
// biome-ignore lint/nursery/noRestrictedImports: Will be removed with react router 6
import {IndexRoute as BaseIndexRoute, Route as BaseRoute} from 'react-router';

import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import withDomainRedirect from 'sentry/utils/withDomainRedirect';
import withDomainRequired from 'sentry/utils/withDomainRequired';

// This module contains customized react-router route components used to
// construct the app routing tree.
//
// The primary customization here relates to supporting rendering dual-routes for customer domains

type CustomProps = {
  /**
   * Human readable route name. This is primarily used in the settings routes.
   */
  name?: string;
  /**
   * Ensure this route renders two routes, one for the "org" path which
   * includes the :orgId slug, and one without.
   *
   * Setting this to `true` will prefix the provided path of the secondary
   * route with:
   *
   *   /organizations/:orgId
   *
   * Setting this will wrap the two routes in withDomainRequired and
   * withDomainRedirect respectively.
   */
  withOrgPath?: boolean;
};

interface SentryRouteProps extends React.PropsWithChildren<RouteProps & CustomProps> {}

type RouteElement = React.ReactElement<SentryRouteProps>;

// The original createRouteFromReactElement extracted from the base route. This
// is not properly typed hence the ts-ignore.
//
// @ts-ignore
const createRouteFromReactElement = BaseRoute.createRouteFromReactElement;

/**
 * Customized React Router Route configuration component.
 */
const Route = BaseRoute as React.ComponentClass<SentryRouteProps>;

// We override the createRouteFromReactElement property to provide support for
// the withOrgPath property.
//
// XXX(epurkhiser): It is important to note! The `Route` component is a
// CONFIGURATION ONLY COMPONENT. It DOES NOT render! This function is part of
// the react-router magic internals that are used to build the route tree by
// traversing the component tree, that is why this logic lives here and not
// inside a custom Route component.
//
// To understand deeper how this works, see [0].
//
// When `withOrgPath` is provided to the Route configuration component the
// react-router router builder will use this function which splits the single
// Route into two, one for the route with :orgId and one for the new-style
// route.
//
// [0]: https://github.com/remix-run/react-router/blob/850de933444d260bfc5460135d308f9d74b52c97/modules/RouteUtils.js#L15
//
// @ts-ignore
Route.createRouteFromReactElement = function (element: RouteElement): PlainRoute {
  const {withOrgPath, component, path} = element.props;

  if (!withOrgPath) {
    return createRouteFromReactElement(element);
  }

  const childRoutes: PlainRoute[] = [
    {
      ...createRouteFromReactElement(element),
      path: `/organizations/:orgId${path}`,
      component: withDomainRedirect(component ?? NoOp),
    },
  ];

  if (USING_CUSTOMER_DOMAIN) {
    childRoutes.unshift({
      ...createRouteFromReactElement(element),
      path,
      component: withDomainRequired(component ?? NoOp),
    });
  }

  return {childRoutes};
};

function NoOp({children}: {children: JSX.Element}) {
  return children;
}

const IndexRoute = BaseIndexRoute as React.ComponentClass<IndexRouteProps & CustomProps>;

export {Route, IndexRoute};
