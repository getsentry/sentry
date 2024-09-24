import {createContext, useContext, useEffect, useRef} from 'react';

import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useRoutes} from 'sentry/utils/useRoutes';

interface Props {
  children: React.ReactNode;
}

/**
 * Rewrite usePrevious for our use case, to ignore the not found route.
 * The previous route can be '/*', which isn't useful for issue grouping.
 */
function usePrevious<T>(value: T): T {
  const ref = useRef<T>(value);
  useEffect(() => {
    // only store the new value if it's not the "not found" route
    if (value !== '/*') {
      ref.current = value;
    }
  }, [value]);
  return ref.current;
}

export const LastKnownRouteContext = createContext<string>('<unknown>');

export function useLastKnownRoute() {
  return useContext(LastKnownRouteContext);
}

/**
 * This provider tracks the last known route that the user has navigated to.
 * This is used to better group issues when we hit "route not found" errors.
 */
export default function LastKnownRouteContextProvider({children}: Props) {
  const route = useRoutes();
  const prevRoute = usePrevious(route);
  const lastKnownRoute = getRouteStringFromRoutes(prevRoute);

  return (
    <LastKnownRouteContext.Provider value={lastKnownRoute}>
      {children}
    </LastKnownRouteContext.Provider>
  );
}
