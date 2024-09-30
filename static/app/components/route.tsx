import type {
  IndexRedirectProps,
  IndexRouteProps,
  RedirectProps,
  RouteProps,
} from 'sentry/types/legacyReactRouter';

// This module contains the "fake" react components that are used as we migrade
// off of react-router 3 to 6. The shims in the utils/reactRouter6Compat module
// read the props off tese components and construct a real react router 6 tree.

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
