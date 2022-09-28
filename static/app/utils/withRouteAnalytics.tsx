import {useContext} from 'react';

import getDisplayName from 'sentry/utils/getDisplayName';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

type WithRouteAnalyticsProps = React.ContextType<typeof RouteAnalyticsContext>;

const withRouteAnalytics = <P extends WithRouteAnalyticsProps>(
  WrappedComponent: React.ComponentType<P>
) => {
  function ComponentWithRouteAnalytics(props: P & WithRouteAnalyticsProps) {
    const routeAnalyticsContext = useContext(RouteAnalyticsContext);
    return (
      <WrappedComponent
        {...({
          ...routeAnalyticsContext,
          ...props,
        } as P)}
      />
    );
  }
  ComponentWithRouteAnalytics.displayName = `withRouteAnalytics(${getDisplayName(
    WrappedComponent
  )})`;
  return ComponentWithRouteAnalytics;
};

export default withRouteAnalytics;
export {WithRouteAnalyticsProps};
