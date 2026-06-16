import {useCallback} from 'react';
import {useNavigate as useReactRouter6Navigate} from 'react-router-dom';
import type {Router} from '@remix-run/router';
import type {LocationDescriptor} from 'history';

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
  const router6Navigate = useReactRouter6Navigate();

  const navigate = useCallback<ReactRouter3Navigate>(
    (to: LocationDescriptor | number, options: NavigateOptions = {}) => {
      if (typeof to === 'number') {
        return router6Navigate(to);
      }

      return router6Navigate(locationDescriptorToTo(to), options);
    },
    [router6Navigate]
  );

  return navigate;
}

/**
 * @deprecated Prefer `useNavigate` in React code. This helper exists only for
 * the narrow set of non-React modules (e.g. the api client) that need an
 * imperative navigate function. Reach for it as a last resort.
 *
 * Build a `ReactRouter3Navigate`-compatible function from a react-router 6
 * `Router` instance.
 */
export function createReactRouter3Navigate(router: Router): ReactRouter3Navigate {
  return (to: LocationDescriptor | number, options: NavigateOptions = {}) => {
    if (typeof to === 'number') {
      router.navigate(to);
      return;
    }
    router.navigate(locationDescriptorToTo(to), options);
  };
}
