import {createContext, useContext, useEffect, useRef} from 'react';
import {useMatches} from 'react-router-dom';

import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';

interface Props {
  children: React.ReactNode;
}

const LastKnownRouteContext = createContext<string>('<unknown>');

export function useLastKnownRoute() {
  return useContext(LastKnownRouteContext);
}

/**
 * This provider tracks the last known route that the user has navigated to.
 * This is used to better group issues when we hit "route not found" errors.
 */
export function LastKnownRouteContextProvider({children}: Props) {
  const matches = useMatches();

  // We could use `usePrevious` here if we didn't need the additional logic to
  // ensure we don't track the not found route, which isn't useful for issue grouping.
  const prevMatches = useRef(matches);
  useEffect(() => {
    // only store the new value if it's not the "not found" route
    if (getRouteStringFromRoutes({matches}) !== '/*') {
      prevMatches.current = matches;
    }
  }, [matches]);

  const lastKnownRoute = getRouteStringFromRoutes({matches: prevMatches.current});

  return <LastKnownRouteContext value={lastKnownRoute}>{children}</LastKnownRouteContext>;
}
