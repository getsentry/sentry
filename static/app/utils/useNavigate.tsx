import {useCallback} from 'react';
import type {LocationDescriptor} from 'history';

import {
  useNavigate as useReactRouterNavigate,
  type DataRouter,
} from 'sentry/router/reactRouter';

import {locationDescriptorToTo} from './reactRouter6Compat/location';

type NavigateOptions = {
  preventScrollReset?: boolean;
  replace?: boolean;
  state?: any;
};

export interface ReactRouter3Navigate {
  (to: LocationDescriptor, options?: NavigateOptions): void;
  (delta: number): void;
}

/**
 * Returns an imperative method for changing the location. Used by `<Link>`s, but
 * may also be used by other elements to change the location.
 *
 * @see https://reactrouter.com/hooks/use-navigate
 */
export function useNavigate(): ReactRouter3Navigate {
  const routerNavigate = useReactRouterNavigate();

  const navigate = useCallback<ReactRouter3Navigate>(
    (to: LocationDescriptor | number, options: NavigateOptions = {}) => {
      if (typeof to === 'number') {
        return routerNavigate(to);
      }

      return routerNavigate(locationDescriptorToTo(to), options);
    },
    [routerNavigate]
  );

  return navigate;
}

/**
 * @deprecated Prefer `useNavigate` in React code. This helper exists only for
 * the narrow set of non-React modules (e.g. the api client) that need an
 * imperative navigate function. Reach for it as a last resort.
 *
 * Build a `ReactRouter3Navigate`-compatible function from a React Router
 * instance.
 */
export function createReactRouter3Navigate(router: DataRouter): ReactRouter3Navigate {
  return (to: LocationDescriptor | number, options: NavigateOptions = {}) => {
    if (typeof to === 'number') {
      router.navigate(to);
      return;
    }
    router.navigate(locationDescriptorToTo(to), options);
  };
}
