import {createContext, useMemo} from 'react';
import {useMatches} from 'react-router-dom';

import {getOverride} from 'sentry/overrideRegistry';
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';

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
  children: React.ReactNode;
}

export function RouteAnalyticsContextProvider({children}: Props) {
  const useRouteActivatedHook = getOverride('react-hook:route-activated');

  const context = {
    params: useParams(),
    location: useLocation(),
    matches: useMatches(),
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

  return <RouteAnalyticsContext value={memoizedValue}>{children}</RouteAnalyticsContext>;
}
