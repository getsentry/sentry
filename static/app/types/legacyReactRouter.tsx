/**
 * These are vendored from react-router v3
 *
 * Once we've fully migrated to react-router 6 we can drop these types
 */
import type {Href, Location, LocationDescriptor, Path, Query} from 'history';

type RoutePattern = string;

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

type NoRoutePropsRouteComponent = React.ComponentType<NoRouteProps>;

type RouteHook = (nextLocation?: Location) => any;

export type IndexRouteProps =
  | {
      component?: NoRoutePropsRouteComponent | undefined;
    }
  | {
      component: React.ComponentType<any>;
      /**
       * Wrap component in props (router, routes, params, location)
       * Also injects the props from the outlet context and outlet as a children
       * See withReactRouter3Props for implementation
       *
       * @deprecated
       */
      deprecatedRouteProps: true;
    };

export type RouteProps = IndexRouteProps & {
  children?: React.ReactNode;
  path?: RoutePattern | undefined;
};

export type PlainRoute = RouteProps & {
  childRoutes?: PlainRoute[] | undefined;
  indexRoute?: PlainRoute | undefined;
};

export interface RouteComponentProps<
  P = Record<string, string | undefined>,
  R = Record<string, string | undefined>,
  Q = any,
> {
  location: Location<Q>;
  params: P;
  route: PlainRoute;
  routeParams: R;
  router: InjectedRouter;
  routes: PlainRoute[];
}

type LocationFunction = (location: LocationDescriptor) => void;
type GoFunction = (n: number) => void;
type NavigateFunction = () => void;
type ActiveFunction = (location: LocationDescriptor, indexOnly?: boolean) => boolean;
type LeaveHookFunction = (route: any, callback: RouteHook) => () => void;
type CreatePartFunction<Part> = (pathOrLoc: LocationDescriptor, query?: any) => Part;

export interface InjectedRouter<P = Record<string, string | undefined>, Q = any> {
  createHref: CreatePartFunction<Href>;
  createPath: CreatePartFunction<Path>;
  go: GoFunction;
  goBack: NavigateFunction;
  goForward: NavigateFunction;
  isActive: ActiveFunction;
  location: Location<Q>;
  params: P;
  push: LocationFunction;
  replace: LocationFunction;
  routes: PlainRoute[];
  setRouteLeaveHook: LeaveHookFunction;
}

export interface WithRouterProps<P = Record<string, string | undefined>, Q = any> {
  location: Location<Q>;
  params: P;
  router: InjectedRouter<P, Q>;
  routes: PlainRoute[];
}

export interface RouteContextInterface<P = Record<string, string | undefined>, Q = any> {
  location: Location<Q>;
  params: P;
  router: InjectedRouter<P, Q>;
  routes: PlainRoute[];
}

export type Route = React.ComponentClass<RouteProps>;

export interface IndexRedirectProps {
  to: RoutePattern;
  query?: Query | undefined;
}

export interface RedirectProps extends IndexRedirectProps {
  from: RoutePattern;
}
