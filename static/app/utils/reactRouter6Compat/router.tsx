import {Children, isValidElement, useEffect} from 'react';
import {
  Navigate,
  type NavigateProps,
  Outlet,
  type RouteObject,
  useOutletContext,
} from 'react-router-dom';
import * as Sentry from '@sentry/react';

import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import useRouter from 'sentry/utils/useRouter';
import {useRoutes} from 'sentry/utils/useRoutes';
import withDomainRedirect from 'sentry/utils/withDomainRedirect';
import withDomainRequired from 'sentry/utils/withDomainRequired';

function isValidComponent(
  element: JSX.Element
): element is React.ReactElement<any, React.NamedExoticComponent<any>> {
  return typeof element.type !== 'string';
}

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

function NoOp({children}: {children: JSX.Element}) {
  return children;
}

interface RedirectProps extends Omit<NavigateProps, 'to'> {
  /**
   * Our compat redirect only supports string to
   */
  to: string;
}

/**
 * Wraps a declarative `Navigate` component to interpolate the params of `to`
 */
function Redirect({to, ...rest}: RedirectProps) {
  const params = useParams();
  const routes = useRoutes();

  // Capture sentry error for this redirect. This will help us understand if we
  // have redirects that are unused or used too much.
  useEffect(() => {
    const routePath = routes
      .map(route => route.path ?? '')
      .filter(path => path !== '')
      .join('/');

    Sentry.captureMessage('Redirect route used', {
      level: 'info',
      tags: {routePath},
    });
  }, [routes]);

  return <Navigate to={replaceRouterParams(to, params)} {...rest} />;
}
Redirect.displayName = 'Redirect';

function getElement(Component: React.ComponentType<any> | undefined) {
  if (!Component) {
    return undefined;
  }

  const WrappedComponent = withReactRouter3Props(Component);

  return <WrappedComponent />;
}

/**
 * Transforms a react-router 3 style route tree into a valid react-router 6
 * router tree.
 */
export function buildReactRouter6Routes(tree: JSX.Element) {
  const routes: RouteObject[] = [];

  Children.forEach(tree, routeNode => {
    if (!isValidElement(routeNode)) {
      return;
    }
    if (!isValidComponent(routeNode)) {
      return;
    }

    const isRoute = routeNode.type.displayName === 'Route';
    const isIndexRoute = routeNode.type.displayName === 'IndexRoute';

    const isRedirect = routeNode.type.displayName === 'Redirect';
    const isIndexRedirect = routeNode.type.displayName === 'IndexRedirect';

    if (isIndexRedirect) {
      routes.push({index: true, element: <Redirect to={routeNode.props.to} replace />});
    }
    if (isRedirect) {
      routes.push({
        path: routeNode.props.from,
        element: <Redirect to={routeNode.props.to} replace />,
      });
    }

    // Elements that are not Route components are likely fragments, just
    // traverse into their children in this case.
    if (!isRoute && !isIndexRoute) {
      routes.push(...buildReactRouter6Routes(routeNode.props.children));
      return;
    }

    const {path, component: Component, children, name, withOrgPath} = routeNode.props;
    const element = getElement(Component);

    // XXX(epurkhiser)
    //
    // - Store the name prop that we use for breadcrumbs in the
    //   handle. This is a react-router 6 concept for where to put arbitrary
    //   route data
    //
    // - We also store the unresolved path in the handle, since we'll need that
    //   to shim the `useRoutes` hook to act like it did n react-router 3,
    //   where the path was not resolved (looks like /issues/:issueId).
    const handle = {name, path};

    if (isIndexRoute) {
      routes.push({index: true, element, handle});
      return;
    }

    if (!withOrgPath) {
      routes.push({path, element, handle, children: buildReactRouter6Routes(children)});
      return;
    }

    // XXX(epurkhiser): This duplicates the customer domain logic in
    // components/route.tsx. When the route has withOrgPath we create two
    // route.

    if (USING_CUSTOMER_DOMAIN) {
      routes.push({
        path,
        element: getElement(withDomainRequired(Component ?? NoOp) as any),
        children: buildReactRouter6Routes(children),
        handle,
      });
    }

    routes.push({
      path: `/organizations/:orgId${path}`,
      element: getElement(withDomainRedirect(Component ?? NoOp)),
      children: buildReactRouter6Routes(children),
      handle,
    });
  });

  return routes;
}
