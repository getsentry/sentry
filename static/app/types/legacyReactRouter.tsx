/**
 * These are vendored from react-router v3
 *
 * Once we've fully migrated to react-router 6 we can drop these types
 */
import type {Location, LocationDescriptor} from 'history';

export type RouteComponent = React.ComponentClass<any> | React.FunctionComponent<any>;

interface IndexRouteProps<Props = any> {
  component?: RouteComponent | undefined;
  props?: Props | undefined;
}

export interface RouteProps<Props = any> extends IndexRouteProps<Props> {
  children?: React.ReactNode;
  path?: string | undefined;
}

export interface PlainRoute<Props = any> extends RouteProps<Props> {
  childRoutes?: PlainRoute[] | undefined;
  indexRoute?: PlainRoute | undefined;
}

export interface RouteComponentProps<
  P = Record<string, string | undefined>,
  R = Record<string, string | undefined>,
  ComponentProps = any,
  Q = any,
> {
  location: Location<Q>;
  params: P;
  route: PlainRoute<ComponentProps>;
  routeParams: R;
  router: InjectedRouter;
  routes: PlainRoute[];
}

type LocationFunction = (location: LocationDescriptor) => void;
type GoFunction = (n: number) => void;
type NavigateFunction = () => void;
type ActiveFunction = (location: LocationDescriptor, indexOnly?: boolean) => boolean;

export interface InjectedRouter<P = Record<string, string | undefined>, Q = any> {
  go: GoFunction;
  goBack: NavigateFunction;
  goForward: NavigateFunction;
  isActive: ActiveFunction;
  location: Location<Q>;
  params: P;
  push: LocationFunction;
  replace: LocationFunction;
  routes: PlainRoute[];
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
