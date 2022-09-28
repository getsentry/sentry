import React, {createContext} from 'react';
import type {RouteContextInterface} from 'react-router';

import HookStore from 'sentry/stores/hookStore';
import {Organization} from 'sentry/types';

const DEFAULT_CONTEXT = {
  setDisableRouteAnalytics: () => {},
  setRouteAnalyticsParams: () => {},
  setOrganization: () => {},
};

export const RouteAnalyticsContext = createContext<{
  setDisableRouteAnalytics: (disable: boolean) => void;
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

  return (
    <RouteAnalyticsContext.Provider
      value={{
        setDisableRouteAnalytics,
        setRouteAnalyticsParams,
        setOrganization,
      }}
    >
      {children}
    </RouteAnalyticsContext.Provider>
  );
}
