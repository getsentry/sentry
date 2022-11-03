import {useCallback, useContext, useEffect, useState} from 'react';

import getDisplayName from 'sentry/utils/getDisplayName';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

type WithRouteAnalyticsProps = {
  setDisableRouteAnalytics: () => void;
  setEventNames: (eventKey: string, eventName: string) => void;
  setGetRouteAnalyticsParams: (
    getRouteAnalyticsParams: () => Record<string, any>
  ) => void;
};

type WrappedProps<P> = Omit<P, keyof WithRouteAnalyticsProps> &
  Partial<WithRouteAnalyticsProps>;

const withRouteAnalytics = <P extends WithRouteAnalyticsProps>(
  WrappedComponent: React.ComponentType<P>
) => {
  const ComponentWithRouteAnalytics: React.FC<WrappedProps<P>> = props => {
    const routeAnalyticsContext = useContext(RouteAnalyticsContext);
    const {
      setRouteAnalyticsParams,
      setDisableRouteAnalytics,
      setEventNames,
      previousUrl,
    } = routeAnalyticsContext;

    /**
     * Disable state logic
     */
    const [localDisabled, setLocalDisabled] = useState(false);
    const setLocalDisableRouteAnalytics = useCallback(() => {
      setLocalDisabled(true);
    }, [setLocalDisabled]);

    // If the child component has called setGetDisableRouteAnalytics,
    // this hook will disabled after until the HoC is unmounted.
    // this is needed because route changes will reset the disabled state
    useEffect(() => {
      if (localDisabled) {
        setDisableRouteAnalytics();
      }
    }, [previousUrl, setDisableRouteAnalytics, localDisabled]);

    /**
     * Event names logic
     */
    const [localEventNames, setLocalEventNames] = useState<
      [string | undefined, string | undefined]
    >([undefined, undefined]);
    // push the event names from our local state to the context
    useEffect(() => {
      const [eventKey, eventName] = localEventNames;
      if (eventKey && eventName) {
        setEventNames(eventKey, eventName);
      }
    }, [previousUrl, setEventNames, localEventNames]);

    /**
     * Analytics params logic
     */

    const [getRouteAnalyticsParams, _setGetRouteAnalyticsParams] = useState<
      (() => Record<string, any>) | undefined
    >();

    const setGetRouteAnalyticsParams = useCallback(
      (fn: () => Record<string, any>) => {
        // need to move the function a level up so that it's not evaluated immediately
        _setGetRouteAnalyticsParams(() => fn);
      },
      [_setGetRouteAnalyticsParams]
    );

    useEffect(() => {
      if (typeof getRouteAnalyticsParams === 'function') {
        setRouteAnalyticsParams(getRouteAnalyticsParams());
      }
    }, [setRouteAnalyticsParams, getRouteAnalyticsParams, previousUrl]);

    return (
      <WrappedComponent
        {...(props as P)}
        {...{
          setGetRouteAnalyticsParams,
          setDisableRouteAnalytics: setLocalDisableRouteAnalytics,
          setEventNames: setLocalEventNames,
        }}
      />
    );
  };
  ComponentWithRouteAnalytics.displayName = `withRouteAnalytics(${getDisplayName(
    WrappedComponent
  )})`;
  return ComponentWithRouteAnalytics;
};

export default withRouteAnalytics;
export {WithRouteAnalyticsProps};
