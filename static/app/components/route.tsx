/**
 * This is our "custom" route object. It varies a bit from react-router 6's
 * routing object in that it doesn't take a rendered component, but instead a
 * component type and handles the rendering itself.
 */
export interface SentryRouteObject {
  /**
   * child components to render under this route
   */
  children?: SentryRouteObject[];
  /**
   * A react component to render or a import promise that will be lazily loaded
   */
  component?: React.ComponentType<any>;
  /**
   * Only enable this route when USING_CUSTOMER_DOMAIN is enabled
   */
  customerDomainOnlyRoute?: true;
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

  // XXX(epurkhiser): In the future we can introduce a `requiresLegacyProps`
  // prop here that will pass in the react-router 3 style routing props. We can
  // use this as a way to slowly get rid of react router 3 style prosp in favor
  // of using the route hooks.
}
