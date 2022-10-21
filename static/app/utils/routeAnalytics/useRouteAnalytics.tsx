import {RouteContextInterface} from 'react-router';

import HookStore from 'sentry/stores/hookStore';
import {Organization} from 'sentry/types';

import {useRouteContext} from '../useRouteContext';

export interface RouteAnalyticCallbacks {
  setDisableRouteAnalytics: () => void;
  setOrganization: (organization: Organization) => void;
  setRouteAnalyticsParams: (params: Record<string, any>) => void;
}

const DEFAULT_CALLBACKS: RouteAnalyticCallbacks = {
  setDisableRouteAnalytics: () => {},
  setRouteAnalyticsParams: () => {},
  setOrganization: () => {},
};

export const ROUTE_ACTIVATED_HOOK_NAME = 'react-hook:route-activated';

/**
 * Setups up the useRouteAnalytics hook when routeContext exists, also
 * setting up the state so organization can be set via OrganizationStore without firing a useX hook.
 */
export const useRouteAnalyticsHookSetup = () => {
  const {setOrganization} = useRouteAnalytics();
  HookStore.persistCallback(
    ROUTE_ACTIVATED_HOOK_NAME,
    'setOrganization',
    setOrganization
  );
};

export const getRouteActivatedHook = (routeContext?: RouteContextInterface) => {
  const routeActivatedHook = HookStore.get(ROUTE_ACTIVATED_HOOK_NAME)[0];
  return routeActivatedHook?.(routeContext) || DEFAULT_CALLBACKS;
};

export const useRouteAnalytics = () => {
  const routeContext = useRouteContext();
  return getRouteActivatedHook(routeContext);
};

export const RouteAnalytics = () => {
  useRouteAnalyticsHookSetup();
  return null;
};
