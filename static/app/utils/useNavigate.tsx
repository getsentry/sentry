import {useCallback, useEffect, useRef} from 'react';

import {useRouteContext} from 'sentry/utils/useRouteContext';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

type NavigateOptions = {
  replace?: boolean;
  state?: any;
};

export function useNavigate() {
  const route = useRouteContext();

  const navigator = route.router;
  const hasMountedRef = useRef(false);
  useEffect(() => {
    hasMountedRef.current = true;
  });
  const navigate = useCallback(
    (to: string | number, options: NavigateOptions = {}) => {
      if (!hasMountedRef.current) {
        throw new Error(
          `You should call navigate() in a React.useEffect(), not when your component is first rendered.`
        );
      }
      if (typeof to === 'number') {
        return navigator.go(to);
      }

      const nextState = {
        pathname: normalizeUrl(to),
        state: options.state,
      };

      if (options.replace) {
        return navigator.replace(nextState);
      }

      return navigator.push(nextState);
    },
    [navigator]
  );
  return navigate;
}
