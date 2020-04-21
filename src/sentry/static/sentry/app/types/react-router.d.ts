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
}
