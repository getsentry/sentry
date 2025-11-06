/**
 * This is our "custom" route object. It varies a bit from react-router 6's
 * routing object in that it doesn't take a rendered component, but instead a
 * component type and handles the rendering itself.
 */
interface BaseRouteObject {
  /**
   * child components to render under this route
   */
  children?: SentryRouteObject[];
  /**
   * Only enable this route when USING_CUSTOMER_DOMAIN is enabled
   */
  customerDomainOnlyRoute?: true;
  /**
   * Injects react router 3 style router props to the component.
   * Including an `Outlet` component as a child element.
   */
  deprecatedRouteProps?: never;
  handle?: Record<string, unknown>;
  /**
   * Is a index route
   */
  index?: boolean;
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
   * The react router path of this component
   */
  path?: string;
  /**
   * The path to redirect to when landing on this route. This will directly
   * render a Redirect component. `component` nad `children` will both be
   * ignored in this case.
   */
  redirectTo?: string;
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
}

/**
 * Enforces that these props are not expected by the component.
 */
type NoRouteProps = {
  [key: string | number | symbol]: any;
  children?: never;
  location?: never;
  params?: never;
  route?: never;
  routeParams?: never;
  router?: never;
  routes?: never;
};

interface DeprecatedPropRoute extends Omit<BaseRouteObject, 'deprecatedRouteProps'> {
  /**
   * A react component that accepts legacy router props (location, params, router, etc.)
   */
  component: React.ComponentType<any>;
  /**
   * Passes legacy route props to the component.
   */
  deprecatedRouteProps: true;
}

interface RouteObject extends BaseRouteObject {
  /**
   * A react component to render. Components that expect RouteComponentProps are
   * not allowed here. Use deprecatedRouteProps: true on legacy components. New
   * components should use the `use{Params,Location}` hooks.
   * Components that expect RouteComponentProps are not allowed here - use deprecatedRouteProps: true instead.
   */
  component: React.ComponentType<NoRouteProps>;
}

interface NoComponentRoute extends BaseRouteObject {
  component?: never;
}

export type SentryRouteObject = RouteObject | DeprecatedPropRoute | NoComponentRoute;
