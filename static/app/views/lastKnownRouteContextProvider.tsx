import {createContext, useContext, useEffect, useRef} from 'react';

import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useRoutes} from 'sentry/utils/useRoutes';

interface Props {
  children: React.ReactNode;
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

  // We could use `usePrevious` here if we didn't need the additional logic to
  // ensure we don't track the not found route, which isn't useful for issue grouping.
  const prevRoute = useRef(route);
  useEffect(() => {
    // only store the new value if it's not the "not found" route
    if (getRouteStringFromRoutes(route) !== '/*') {
      prevRoute.current = route;
    }
  }, [route]);

  const lastKnownRoute = getRouteStringFromRoutes(prevRoute.current);

  return (
    <LastKnownRouteContext.Provider value={lastKnownRoute}>
      {children}
    </LastKnownRouteContext.Provider>
  );
}
