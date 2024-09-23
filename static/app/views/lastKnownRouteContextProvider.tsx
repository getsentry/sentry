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
