import {createContext, useContext} from 'react';

import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import usePrevious from 'sentry/utils/usePrevious';
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
 * We keep track of the penultimate route in case the previous route
 * is somehow the not found route.
 */
export default function LastKnownRouteContextProvider({children}: Props) {
  const route = useRoutes();
  const prevRoute = usePrevious(route);
  const penultimateRoute = usePrevious(prevRoute);
  let lastKnownRoute = getRouteStringFromRoutes(prevRoute);

  if (lastKnownRoute === '/*') {
    lastKnownRoute = getRouteStringFromRoutes(penultimateRoute);
  }

  return (
    <LastKnownRouteContext.Provider value={lastKnownRoute}>
      {children}
    </LastKnownRouteContext.Provider>
  );
}
