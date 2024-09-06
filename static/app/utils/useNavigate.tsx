import {useCallback, useEffect, useRef} from 'react';
import {useNavigate as useReactRouter6Navigate} from 'react-router-dom';
import type {LocationDescriptor} from 'history';

import {NODE_ENV} from 'sentry/constants';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

import {locationDescriptorToTo} from './reactRouter6Compat/location';
import {useRouteContext} from './useRouteContext';

type NavigateOptions = {
  replace?: boolean;
  state?: any;
};

interface ReactRouter3Navigate {
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
  // When running in test mode we still read from the legacy route context to
  // keep test compatability while we fully migrate to react router 6
  const useReactRouter6 = window.__SENTRY_USING_REACT_ROUTER_SIX && NODE_ENV !== 'test';

  if (useReactRouter6) {
    // biome-ignore lint/correctness/useHookAtTopLevel: react-router-6 migration
    const router6Navigate = useReactRouter6Navigate();

    // XXX(epurkhiser): Translate legacy LocationDescriptor to To in the
    // navigate helper.

    // biome-ignore lint/correctness/useHookAtTopLevel: react-router-6 migration
    const navigate = useCallback<ReactRouter3Navigate>(
      (to: LocationDescriptor | number, options: NavigateOptions = {}) =>
        typeof to === 'number'
          ? router6Navigate(to)
          : router6Navigate(locationDescriptorToTo(to), options),
      [router6Navigate]
    );

    return navigate;
  }

  // XXX(epurkihser): We are using react-router 3 here, to avoid recursive
  // dependencies we just use the useRouteContext instead of useRouter here

  // biome-ignore lint/correctness/useHookAtTopLevel: react-router-6 migration
  const {router} = useRouteContext();

  // biome-ignore lint/correctness/useHookAtTopLevel: react-router-6 migration
  const hasMountedRef = useRef(false);

  // biome-ignore lint/correctness/useHookAtTopLevel: react-router-6 migration
  useEffect(() => {
    hasMountedRef.current = true;
  });

  // biome-ignore lint/correctness/useHookAtTopLevel: react-router-6 migration
  const navigate = useCallback<ReactRouter3Navigate>(
    (to: LocationDescriptor | number, options: NavigateOptions = {}) => {
      if (!hasMountedRef.current) {
        throw new Error(
          `You should call navigate() in a React.useEffect(), not when your component is first rendered.`
        );
      }
      if (typeof to === 'number') {
        return router.go(to);
      }

      const normalizedTo = normalizeUrl(to);

      const nextState: LocationDescriptor =
        typeof normalizedTo === 'string'
          ? {
              pathname: normalizedTo,
              state: options.state,
            }
          : {
              ...normalizedTo,
              state: options.state,
            };

      if (options.replace) {
        return router.replace(nextState);
      }

      return router.push(nextState);
    },
    [router]
  );
  return navigate;
}
