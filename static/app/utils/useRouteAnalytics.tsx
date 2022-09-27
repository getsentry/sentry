import {useContext, useEffect} from 'react';

import HookStore from 'sentry/stores/hookStore';
import {OrganizationContext} from 'sentry/views/organizationContext';

const DEFAULT_CONTEXT = {
  setDisableRouteAnalytics: () => {},
  setRouteAnalyticsParams: () => {},
  setOrganization: () => {},
};

// This is the hook that is used to pass route analytics functions to routes.
export default function useRouteAnalytics() {
  const organization = useContext(OrganizationContext);
  const useRouteActivatedHook = HookStore.get('react-hook:route-activated')[0];
  const {setDisableRouteAnalytics, setRouteAnalyticsParams, setOrganization} =
    useRouteActivatedHook?.() || DEFAULT_CONTEXT;
  useEffect(() => {
    organization && setOrganization(organization);
  }, [organization, setOrganization]);
  return {...setDisableRouteAnalytics, setRouteAnalyticsParams};
}
