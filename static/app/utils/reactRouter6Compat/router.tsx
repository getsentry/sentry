import {useEffect} from 'react';
import {
  Navigate,
  Outlet,
  useOutletContext,
  type NavigateProps,
  type RouteObject,
} from 'react-router-dom';
import * as Sentry from '@sentry/react';

import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {PRELOAD_HANDLE} from 'sentry/router/preload';
import type {SentryRouteObject} from 'sentry/router/types';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import useRouter from 'sentry/utils/useRouter';
import {useRoutes} from 'sentry/utils/useRoutes';
import withDomainRedirect from 'sentry/utils/withDomainRedirect';
import withDomainRequired from 'sentry/utils/withDomainRequired';

/**
 * Because some of our views use cloneElement to inject route props into the
 * children views, we need to capture those props and pass them as outlet
 * context. The WithReactRouter3Props HoC component will inject the outlet
 * context into the view
 */
function OurOutlet(props: any) {
  return <Outlet context={props} />;
}

/**
 * HoC which injects params and a route object that emulate react-router3
 */
function withReactRouter3Props(Component: React.ComponentType<any>) {
  function WithReactRouter3Props() {
    const params = useParams();
    const router = useRouter();
    const routes = useRoutes();
    const location = useLocation();
    const outletContext = useOutletContext<Record<string, unknown>>();

    return (
      <Component
        router={router}
        routes={routes}
        params={params}
        location={location}
        {...outletContext}
      >
        <OurOutlet />
      </Component>
    );
  }

  return WithReactRouter3Props;
}

interface RedirectProps extends Omit<NavigateProps, 'to'> {
  /**
   * Our Redirect only supports string to
   */
  to: string;
}

/**
 * Wraps a declarative `Navigate` component to interpolate the params of `to`
 */
function Redirect({to, ...rest}: RedirectProps) {
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
Redirect.displayName = 'Redirect';

function getElement(
  Component: React.ComponentType<any> | undefined,
  deprecatedRouteProps = false
) {
  if (!Component) {
    return undefined;
  }

  if (deprecatedRouteProps) {
    const WrappedComponent = withReactRouter3Props(Component);

    return <WrappedComponent />;
  }

  return <Component />;
}

/**
 * Converts a SentryRouteObject tree into a react-router RouteObject tree.
 */
export function translateSentryRoute(tree: SentryRouteObject): RouteObject {
  const {
    name,
    path,
    withOrgPath,
    redirectTo,
    customerDomainOnlyRoute,
    component,
    deprecatedRouteProps,
  } = tree;

  if (customerDomainOnlyRoute && !USING_CUSTOMER_DOMAIN) {
    return {};
  }

  if (redirectTo !== undefined) {
    return {index: tree.index, path, element: <Redirect to={redirectTo} replace />};
  }

  // XXX(epurkhiser)
  //
  // - Store the name prop that we use for breadcrumbs in the handle.
  //
  // - We also store the unresolved path in the handle, since we'll need that
  //   to shim the `useRoutes` hook to act like it did n react-router 3,
  //   where the path was not resolved (looks like /issues/:issueId). Once we
  //   remove usages of useRoutes we can remove this value from the handle.
  const handle: Record<string, unknown> = {...tree.handle, name, path};

  if (component && PRELOAD_HANDLE in component) {
    handle[PRELOAD_HANDLE] = component[PRELOAD_HANDLE];
  }

  if (tree.index) {
    return {index: true, element: getElement(component, deprecatedRouteProps), handle};
  }

  const children = tree.children?.map(translateSentryRoute);

  // Witohut the withOrgPath we only need to generate a single route, otherwise
  // we need to generate multiple routes, one including the
  // /organizations/:ogId prefix, and one without
  if (!withOrgPath) {
    return {path, element: getElement(component, deprecatedRouteProps), handle, children};
  }

  const dualRoutes: RouteObject[] = [];

  const hasComponent = !!component;

  if (USING_CUSTOMER_DOMAIN) {
    dualRoutes.push({
      path,
      element: hasComponent
        ? getElement(withDomainRequired(component), deprecatedRouteProps)
        : undefined,
      handle,
      children,
    });
  }

  dualRoutes.push({
    path: `/organizations/:orgId${path}`,
    element: hasComponent
      ? getElement(withDomainRedirect(component), deprecatedRouteProps)
      : undefined,
    handle,
    children,
  });

  return {children: dualRoutes};
}
