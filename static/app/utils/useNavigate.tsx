import {useCallback, useEffect, useRef} from 'react';
import type {LocationDescriptor} from 'history';

import normalizeUrl from 'sentry/utils/url/normalizeUrl';

import useRouter from './useRouter';

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
export function useNavigate() {
  const router = useRouter();
  const hasMountedRef = useRef(false);

  useEffect(() => {
    hasMountedRef.current = true;
  });

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
