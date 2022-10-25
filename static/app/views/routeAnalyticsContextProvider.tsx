import React, {createContext, useMemo} from 'react';
import type {RouteContextInterface} from 'react-router';

import HookStore from 'sentry/stores/hookStore';
import {Organization} from 'sentry/types';

const DEFAULT_CONTEXT = {
  setDisableRouteAnalytics: () => {},
  setRouteAnalyticsParams: () => {},
  setOrganization: () => {},
};

/**
 * This context is used to set analytics params for route based analytics.
 * It is used by multiple different hooks and an HoC, each with
 * slightly different use cases.
 */
export const RouteAnalyticsContext = createContext<{
  setDisableRouteAnalytics: () => void;
  setOrganization: (organization: Organization) => void;
  setRouteAnalyticsParams: (params: Record<string, any>) => void;
}>(DEFAULT_CONTEXT);

interface Props extends RouteContextInterface {
  children?: React.ReactNode;
}

export default function RouteAnalyticsContextProvider({children, ...props}: Props) {
  const useRouteActivatedHook = HookStore.get('react-hook:route-activated')[0];
  const {setDisableRouteAnalytics, setRouteAnalyticsParams, setOrganization} =
    useRouteActivatedHook?.(props) || DEFAULT_CONTEXT;

  const memoizedValue = useMemo(
    () => ({
      setDisableRouteAnalytics,
      setRouteAnalyticsParams,
      setOrganization,
    }),
    [setDisableRouteAnalytics, setRouteAnalyticsParams, setOrganization]
  );

  return (
    <RouteAnalyticsContext.Provider value={memoizedValue}>
      {children}
    </RouteAnalyticsContext.Provider>
  );
}
