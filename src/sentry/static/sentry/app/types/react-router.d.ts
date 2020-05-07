import {ComponentClass, ComponentType, StatelessComponent} from 'react';
import {WithRouterProps} from 'react-router/lib/withRouter';
import {InjectedRouter, Params} from 'react-router/lib/Router';
import {Location} from 'history';
import {PlainRoute} from 'react-router/lib/Route';

declare module 'react-router' {
  interface InjectedRouter<P = Params, Q = any> {
    location: Location<Q>;
    params: P;
    routes: PlainRoute[];
  }

  interface WithRouterProps<P = Params, Q = any> {
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
