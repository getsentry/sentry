/**
 * These are vendored from react-router v3
 *
 * Once we've fully migrated to react-router 6 we can drop these types
 */
import type {Location, LocationDescriptor} from 'history';

interface IndexRouteProps<Props = any> {
  component?: React.ComponentType<any> | undefined;
  props?: Props | undefined;
}

interface RouteProps<Props = any> extends IndexRouteProps<Props> {
  children?: React.ReactNode;
  path?: string | undefined;
}

export interface PlainRoute<Props = any> extends RouteProps<Props> {
  childRoutes?: PlainRoute[] | undefined;
  indexRoute?: PlainRoute | undefined;
}

/**
 * @deprecated Do not use in new components. use `use{Layout,Props}` instead.
 */
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

/**
 * @deprecated Do not use in new components. use `use{Layout,Props}` instead.
 */
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
