import {useEffect} from 'react';
import {Navigate, type NavigateProps} from 'react-router-dom';
import * as Sentry from '@sentry/react';

import type {
  IndexRedirectProps,
  IndexRouteProps,
  RedirectProps,
  RouteProps,
} from 'sentry/types/legacyReactRouter';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';

// This module contains the "fake" react components that are used as we migrade
// off of react-router 3 to 6. The shims in the utils/reactRouter6Compat module
// read the props off tese components and construct a real react router 6 tree.

type CustomProps = {
  /**
   * Human readable route name. This is primarily used in the settings routes.
   */
  name?: string;
  /**
   * XXX(epurkhiser): This should ONLY be used as we migrate routes away from
   * the legacy `Route` style tree.
   */
  newStyleChildren?: SentryRouteObject[];
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

/**
 * This is our "custom" route object. It varies a bit from react-router 6's
 * routing object in that it doesn't take a rendered component, but instead a
 * component type and handles the rendering itself.
 */
export interface SentryRouteObject extends CustomProps {
  /**
   * child components to render under this route
   */
  children?: SentryRouteObject[];
  /**
   * A react component to render or a import promise that will be lazily loaded
   */
  component?: React.ComponentType<any>;
  /**
   * Is a index route
   */
  index?: boolean;
  /**
   * The react router path of this component
   */
  path?: string;

  // XXX(epurkhiser): In the future we can introduce a `requiresLegacyProps`
  // prop here that will pass in the react-router 3 style routing props. We can
  // use this as a way to slowly get rid of react router 3 style prosp in favor
  // of using the route hooks.
}

interface SentryRouteProps extends React.PropsWithChildren<RouteProps & CustomProps> {}

export function Route(_props: SentryRouteProps) {
  // XXX: These routes are NEVER rendered
  return null;
}
Route.displayName = 'Route';

export function IndexRoute(_props: IndexRouteProps & CustomProps) {
  // XXX: These routes are NEVER rendered
  return null;
}
IndexRoute.displayName = 'IndexRoute';

export function Redirect(_props: RedirectProps) {
  // XXX: These routes are NEVER rendered
  return null;
}
Redirect.displayName = 'Redirect';

export function IndexRedirect(_props: IndexRedirectProps) {
  // XXX: These routes are NEVER rendered
  return null;
}
IndexRedirect.displayName = 'IndexRedirect';

interface WorkingRedirectProps extends Omit<NavigateProps, 'to'> {
  /**
   * Our compat redirect only supports string to
   */
  to: string;
}

/**
 * Working Redirect component for use in route objects
 * Wraps a declarative `Navigate` component to interpolate the params of `to`
 */
export function WorkingRedirect({to, ...rest}: WorkingRedirectProps) {
  const params = useParams();
  const routes = useRoutes();

  // Capture sentry span for this redirect. This will help us understand if we
  // have redirects that are unused or used too much.
  useEffect(() => {
    const routePath = routes
      .map(route => route.path ?? '')
      .filter(path => path !== '')
      .join('/');

    Sentry.startSpan(
      {
        name: 'Redirect route used',
        op: 'navigation.redirect',
        attributes: {routePath},
      },
      () => {
        // End span automatically
      }
    );
  }, [routes]);

  return <Navigate to={replaceRouterParams(to, params)} {...rest} />;
}
