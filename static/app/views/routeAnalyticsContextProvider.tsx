import {createContext, useMemo} from 'react';

import HookStore from 'sentry/stores/hookStore';
import type {RouteContextInterface} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import useRouter from 'sentry/utils/useRouter';
import {useRoutes} from 'sentry/utils/useRoutes';

const DEFAULT_CONTEXT = {
  setDisableRouteAnalytics: () => {},
  setRouteAnalyticsParams: () => {},
  setOrganization: () => {},
  setEventNames: () => {},
  previousUrl: '',
};

/**
 * This context is used to set analytics params for route based analytics.
 * It is used by multiple different hooks and an HoC, each with
 * slightly different use cases.
 */
export const RouteAnalyticsContext = createContext<{
  previousUrl: string;
  /**
   * Enable/disable route analytics manually
   * @param disabled - defaults to true
   */
  setDisableRouteAnalytics: (disabled?: boolean) => void;
  setEventNames: (evetKey: string, eventName: string) => void;
  setOrganization: (organization: Organization) => void;
  setRouteAnalyticsParams: (params: Record<string, any>) => void;
}>(DEFAULT_CONTEXT);

interface Props {
  children?: React.ReactNode;
}

export default function RouteAnalyticsContextProvider({children}: Props) {
  const useRouteActivatedHook = HookStore.get('react-hook:route-activated')[0];

  const context: RouteContextInterface = {
    params: useParams(),
    routes: useRoutes(),
    router: useRouter(),
    location: useLocation(),
  };

  const {
    setDisableRouteAnalytics,
    setRouteAnalyticsParams,
    setOrganization,
    setEventNames,
    previousUrl,
  } = useRouteActivatedHook?.(context) || DEFAULT_CONTEXT;

  const memoizedValue = useMemo(
    () => ({
      setDisableRouteAnalytics,
      setRouteAnalyticsParams,
      setOrganization,
      setEventNames,
      previousUrl,
    }),
    [
      setDisableRouteAnalytics,
      setRouteAnalyticsParams,
      setOrganization,
      setEventNames,
      previousUrl,
    ]
  );

  return (
    <RouteAnalyticsContext.Provider value={memoizedValue}>
      {children}
    </RouteAnalyticsContext.Provider>
  );
}
