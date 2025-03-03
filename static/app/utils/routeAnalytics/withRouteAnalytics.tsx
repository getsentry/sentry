import {useContext} from 'react';

import getDisplayName from 'sentry/utils/getDisplayName';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

type WithRouteAnalyticsProps = React.ContextType<typeof RouteAnalyticsContext>;

type WrappedProps<P> = Omit<P, keyof WithRouteAnalyticsProps> &
  Partial<WithRouteAnalyticsProps>;

const withRouteAnalytics = <P extends WithRouteAnalyticsProps>(
  WrappedComponent: React.ComponentType<P>
) => {
  function ComponentWithRouteAnalytics(props: WrappedProps<P>) {
    const routeAnalyticsContext = useContext(RouteAnalyticsContext);
    // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
    return <WrappedComponent {...(props as P as any)} {...routeAnalyticsContext} />;
  }
  ComponentWithRouteAnalytics.displayName = `withRouteAnalytics(${getDisplayName(
    WrappedComponent
  )})`;
  return ComponentWithRouteAnalytics;
};

export default withRouteAnalytics;
export type {WithRouteAnalyticsProps};
