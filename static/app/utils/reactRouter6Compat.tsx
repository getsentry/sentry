import {Children, isValidElement} from 'react';
import {
  generatePath,
  type Location as Location6,
  Navigate,
  type NavigateProps,
  Outlet,
  type RouteObject,
  type To,
  useOutletContext,
} from 'react-router-dom';
import type {Location as Location3, LocationDescriptor, Query} from 'history';
import * as qs from 'query-string';

import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';

import {useLocation} from './useLocation';
import {useParams} from './useParams';
import useRouter from './useRouter';
import {useRoutes} from './useRoutes';
import withDomainRedirect from './withDomainRedirect';
import withDomainRequired from './withDomainRequired';

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
    const outletContext = useOutletContext<{}>();

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

  return <Navigate to={generatePath(to, params)} {...rest} />;
}

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

    // XXX(epurkhiser): Store the name prop that we use for breadcrumbs in the
    // handle. This is a react-router 6 concept for where to put arbitrary
    // route data
    const handle = {name};

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

/**
 * Translates a react-router 3 LocationDescriptor to a react-router 6 To.
 */
export function locationDescriptorToTo(path: LocationDescriptor): To {
  if (typeof path === 'string') {
    return path;
  }

  const to: To = {
    pathname: path.pathname,
  };

  if (path.hash) {
    to.hash = path.hash;
  }
  if (path.search) {
    to.search = path.search;
  }
  if (path.query) {
    to.search = `?${qs.stringify(path.query)}`;
  }

  // XXX(epurkhiser): We ignore the location state param

  return to;
}

type DefaultQuery<T = string> = {
  [key: string]: T | T[] | null | undefined;
};

/**
 * Translate react-router 6 Location object to a react-router3 Location
 */
export function location6ToLocation3<Q extends Query = DefaultQuery>(
  location: Location6
): Location3<Q> {
  const {pathname, search, hash, state, key} = location;

  return {
    pathname: pathname,
    search: search,
    query: qs.parse(search) as Q,
    hash: hash,
    state,
    key,

    // XXX(epurkhiser): It would be possible to extract this from the
    // react-router 6 browserHistory object. But beecause of how we're
    // shimming it it's a little hard, so for now just mock
    action: 'POP',
  } satisfies Location3<Q>;
}
