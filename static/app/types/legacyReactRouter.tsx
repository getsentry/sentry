/**
 * These are vendored from react-router v3
 *
 * Once we've fully migrated to react-router 6 we can drop these types
 */
import type {
  Href,
  Location,
  LocationDescriptor,
  LocationState,
  Path,
  Pathname,
  Query,
} from 'history';

export interface Params {
  [key: string]: string;
}

export type RoutePattern = string;
export type RouteComponent = React.ComponentClass<any> | React.FunctionComponent<any>;

export interface RouteComponents {
  [name: string]: RouteComponent;
}

export interface RouterState<Q = any> {
  components: RouteComponent[];
  location: Location<Q>;
  params: Params;
  routes: PlainRoute[];
}

export interface RedirectFunction {
  (location: LocationDescriptor): void;
  (state: LocationState, pathname: Pathname | Path, query?: Query): void;
}

type AnyFunction = (...args: any[]) => any;

export type EnterHook = (
  nextState: RouterState,
  replace: RedirectFunction,
  callback?: AnyFunction
) => any;

export type LeaveHook = (prevState: RouterState) => any;

export type ChangeHook = (
  prevState: RouterState,
  nextState: RouterState,
  replace: RedirectFunction,
  callback?: AnyFunction
) => any;

export type RouteHook = (nextLocation?: Location) => any;

type ComponentCallback = (err: any, component: RouteComponent) => any;
type ComponentsCallback = (err: any, components: RouteComponents) => any;

export interface IndexRouteProps<Props = any> {
  component?: RouteComponent | undefined;
  components?: RouteComponents | undefined;
  getComponent?(nextState: RouterState, callback: ComponentCallback): void;
  getComponents?(nextState: RouterState, callback: ComponentsCallback): void;
  onChange?: ChangeHook | undefined;
  onEnter?: EnterHook | undefined;
  onLeave?: LeaveHook | undefined;
  props?: Props | undefined;
}

export interface RouteProps<Props = any> extends IndexRouteProps<Props> {
  children?: React.ReactNode;
  path?: RoutePattern | undefined;
}

type RouteCallback = (err: any, route: PlainRoute) => void;
type RoutesCallback = (err: any, routesArray: PlainRoute[]) => void;

export interface PlainRoute<Props = any> extends RouteProps<Props> {
  childRoutes?: PlainRoute[] | undefined;
  getChildRoutes?(partialNextState: LocationState, callback: RoutesCallback): void;
  getIndexRoute?(partialNextState: LocationState, callback: RouteCallback): void;
  indexRoute?: PlainRoute | undefined;
}

export interface RouteComponentProps<P, R, ComponentProps = any, Q = any> {
  location: Location<Q>;
  params: P & R;
  route: PlainRoute<ComponentProps>;
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

export interface InjectedRouter<P = Record<string, string>, Q = any> {
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

export interface WithRouterProps<P = Record<string, string>, Q = any> {
  location: Location<Q>;
  params: P;
  router: InjectedRouter<P, Q>;
  routes: PlainRoute[];
}

export interface RouteContextInterface<P = Record<string, string>, Q = any> {
  location: Location<Q>;
  params: P;
  router: InjectedRouter<P, Q>;
  routes: PlainRoute[];
}

export type Route = React.ComponentClass<RouteProps>;
