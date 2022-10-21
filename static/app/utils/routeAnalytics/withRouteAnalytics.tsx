import getDisplayName from 'sentry/utils/getDisplayName';

import {RouteAnalyticCallbacks, useRouteAnalytics} from './useRouteAnalytics';

type WithRouteAnalyticsProps = RouteAnalyticCallbacks;

type WrappedProps<P> = Omit<P, keyof WithRouteAnalyticsProps> &
  Partial<WithRouteAnalyticsProps>;

const withRouteAnalytics = <P extends WithRouteAnalyticsProps>(
  WrappedComponent: React.ComponentType<P>
) => {
  const ComponentWithRouteAnalytics: React.FC<WrappedProps<P>> = props => {
    const routeAnaltyics = useRouteAnalytics();
    return <WrappedComponent {...(props as P)} {...routeAnaltyics} />;
  };
  ComponentWithRouteAnalytics.displayName = `withRouteAnalytics(${getDisplayName(
    WrappedComponent
  )})`;
  return ComponentWithRouteAnalytics;
};

export default withRouteAnalytics;
export {WithRouteAnalyticsProps};
