import {Outlet} from 'sentry/router/reactRouter';

/**
 * Route component version that renders children via Outlet.
 */
export function AppBodyContentRoute() {
  return <Outlet />;
}
