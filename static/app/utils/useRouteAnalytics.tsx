import {useContext, useEffect} from 'react';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

// This is the hook that is used to pass route analytics functions to routes.
export default function useRouteAnalytics() {
  // don't use this hook for setting organization
  const {
    setOrganization: _setOrganization,
    setRouteAnalyticsParams,
    setDisableRouteAnalytics,
  } = useContext(RouteAnalyticsContext);
  // wrap the setters in a useEffect
  const useRouteAnalyticsParameters = (params: Record<string, any>) => {
    const dependencies = Object.values(params);
    useEffect(() => {
      setRouteAnalyticsParams(params);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies);
  };
  const useDisableRouteAnalytics = (disable: boolean) => {
    useEffect(() => {
      setDisableRouteAnalytics(disable);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [disable]);
  };

  return {useRouteAnalyticsParameters, useDisableRouteAnalytics};
}
