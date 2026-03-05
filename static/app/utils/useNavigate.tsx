import {useCallback} from 'react';
import {useNavigate as useReactRouter6Navigate} from 'react-router-dom';
import type {LocationDescriptor} from 'history';

import normalizeUrl from 'sentry/utils/url/normalizeUrl';

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

      const normalizedTo = normalizeUrl(to);
      return router6Navigate(locationDescriptorToTo(normalizedTo), options);
    },
    [router6Navigate]
  );

  return navigate;
}
