import {createContext} from 'react';

import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import usePrevious from 'sentry/utils/usePrevious';
import {useRoutes} from 'sentry/utils/useRoutes';

interface Props {
  children?: React.ReactNode;
}

export const LastKnownRouteContext = createContext<string>('');

function useLastKnownRoute() {
  const route = useRoutes();
  const lastRoute = usePrevious(route);
  return getRouteStringFromRoutes(lastRoute);
}

export default function LastKnownRouteContextProvider({children}: Props) {
  const route = useLastKnownRoute();

  return (
    <LastKnownRouteContext.Provider value={route}>
      {children}
    </LastKnownRouteContext.Provider>
  );
}
