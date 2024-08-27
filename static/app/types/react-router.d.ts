import type {ComponentClass, ComponentType, FunctionComponent, ReactNode} from 'react';
import type {InjectedRouter, PlainRoute, WithRouterProps} from 'react-router';
import type {Location} from 'history';

declare module 'react-router' {
  // React 18 removed children from ComponentType, this adds them back
  interface RouterProps {
    children?: ReactNode;
  }

  // React 18 removed children from ComponentType, this adds them back
  interface RouteProps {
    children?: ReactNode;
  }

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
}
