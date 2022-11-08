import {useContext} from 'react';

import getDisplayName from 'sentry/utils/getDisplayName';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

type WithRouteAnalyticsProps = React.ContextType<typeof RouteAnalyticsContext>;

type WrappedProps<P> = Omit<P, keyof WithRouteAnalyticsProps> &
  Partial<WithRouteAnalyticsProps>;

const withRouteAnalytics = <P extends WithRouteAnalyticsProps>(
  WrappedComponent: React.ComponentType<P>
) => {
  const ComponentWithRouteAnalytics: React.FC<WrappedProps<P>> = props => {
    const routeAnalyticsContext = useContext(RouteAnalyticsContext);
    return <WrappedComponent {...(props as P)} {...routeAnalyticsContext} />;
  };
  ComponentWithRouteAnalytics.displayName = `withRouteAnalytics(${getDisplayName(
    WrappedComponent
  )})`;
  return ComponentWithRouteAnalytics;
};

export default withRouteAnalytics;
export {WithRouteAnalyticsProps};
