import type {ComponentClass, ComponentType, StatelessComponent} from 'react';
import type {InjectedRouter, PlainRoute, WithRouterProps} from 'react-router';
import type {Location} from 'history';

declare module 'react-router' {
  interface InjectedRouter<P = Record<string, string>, Q = any> {
    location: Location<Q>;
    params: P;
    routes: PlainRoute[];
  }

  interface WithRouterProps<P = Record<string, string>, Q = any> {
    location: Location<Q>;
    params: P;
    router: InjectedRouter<P, Q>;
    routes: PlainRoute[];
  }

  interface RouteContextInterface {
    location: Location<Q>;
    params: P;
    router: InjectedRouter<P, Q>;
    routes: PlainRoute[];
  }

  type ComponentConstructor<P> =
    | ComponentClass<P>
    | StatelessComponent<P>
    | ComponentType<P>;

  declare function withRouter<P extends WithRouterProps>(
    component: ComponentConstructor<P>,
    options?: Options
  ): ComponentClass<Omit<P, keyof WithRouterProps>>;

  declare function withRouter<P extends WithRouterProps, S>(
    component: ComponentConstructor<P> & S,
    options?: Options
  ): ComponentClass<Omit<P, keyof WithRouterProps>> & S;
}
