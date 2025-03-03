import {useCallback, useEffect, useState} from 'react';

import type {Hooks} from 'sentry/types/hooks';
import type {Organization} from 'sentry/types/organization';
import usePrevious from 'sentry/utils/usePrevious';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import rawTrackAnalyticsEvent from 'getsentry/utils/rawTrackAnalyticsEvent';
import {
  convertToReloadPath,
  getEventPath,
  getUrlFromLocation,
} from 'getsentry/utils/routeAnalytics';
import trackMetric from 'getsentry/utils/trackMetric';

/**
 * @internal exported for tests only
 * give up to 7s for things to load
 */
export const DELAY_TIME_MS = 7000;

type Props = Parameters<Hooks['react-hook:route-activated']>[0];

export default function useRouteActivatedHook(props: Props) {
  const {routes, location} = props;
  const [analyticsParams, _setRouteAnalyticsParams] = useState({});
  const [disableAnalytics, _setDisableRouteAnalytics] = useState(false);
  const [hasSentAnalytics, setHasSentAnalytics] = useState(false);
  const [readyToSend, setReadyToSend] = useState(false);
  const [mountTime, setMountTime] = useState(0);
  const prevRoutes = usePrevious(routes);
  const prevLocation = usePrevious(location);
  // Reload event name
  const [_eventKey, setEventKey] = useState<string | undefined>(undefined);
  // Amplitude event name
  const [_eventName, setEventName] = useState<string | undefined>(undefined);
  // this hook is above the normal organization context so we have to
  // set it from a lower level and pass it here
  const [organization, setOrganization] = useState<Organization | null>(null);

  // keep track of the previous URL so we can detect trigger hooks after resetting the route params
  const previousUrl = getUrlFromLocation(prevLocation);

  const currentRoute = getEventPath(routes);
  const prevRoute = getEventPath(prevRoutes);

  const considerSendingAnalytics =
    organization && !hasSentAnalytics && !disableAnalytics && mountTime > 0;

  useEffect(() => {
    setMountTime(Date.now());
  }, []);

  const sendRouteParams = useCallback(
    (route: string, localOrganization: Organization) => {
      const reloadPath = convertToReloadPath(route);

      SubscriptionStore.get(localOrganization.slug, (subscription: any) => {
        // optional way to override the event name for Reload and Amplitude
        // note null means something different than undefined for eventName so
        // checking for that explicitly
        const eventKey = _eventKey !== undefined ? _eventKey : `page_view.${reloadPath}`;
        const eventName = _eventName !== undefined ? _eventName : `Page View: ${route}`;

        rawTrackAnalyticsEvent(
          {
            eventKey,
            eventName,
            organization: localOrganization,
            subscription,
            url: previousUrl, // pass in the previous URL
            // pass in the parameterized path as well
            parameterized_path: reloadPath,
            ...analyticsParams,
          },
          {time: mountTime}
        );

        // Also track page veiw as a reload metric. This will be propegated to
        // DataDog and can be used for page view SLOs
        trackMetric(eventKey, 1);
      });
    },
    [analyticsParams, mountTime, previousUrl, _eventName, _eventKey]
  );

  // This hook is called when the route changes
  // we need to send analytics for the previous route if we haven't yet
  // then reset the route params
  useEffect(() => {
    // if the only reason we haven't analytics is because we haven't hit DELAY_TIME_MS
    // the we need to emit it immediately before handing the new route
    if (considerSendingAnalytics && !readyToSend) {
      sendRouteParams(prevRoute, organization);
    }

    // when the route changes, reset the analytics params
    setHasSentAnalytics(false);
    _setDisableRouteAnalytics(false);
    _setRouteAnalyticsParams({});
    setEventKey(undefined);
    setEventName(undefined);
    setMountTime(Date.now());
    // this hook should only fire when the route changes and nothing else
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoute]);

  // This hook is in charge of sending analytics after DELAY_TIME_MS has passed
  useEffect(() => {
    if (readyToSend && considerSendingAnalytics) {
      sendRouteParams(currentRoute, organization);
      // mark that we have sent the analytics
      setHasSentAnalytics(true);
      setReadyToSend(false);
    }
  }, [
    sendRouteParams,
    readyToSend,
    organization,
    considerSendingAnalytics,
    currentRoute,
  ]);

  const setDisableRouteAnalytics = useCallback((disabled = true) => {
    _setDisableRouteAnalytics(disabled);
  }, []);

  const setRouteAnalyticsParams = useCallback((params: Record<string, any>) => {
    // add to existing params
    _setRouteAnalyticsParams(existingParams => ({...existingParams, ...params}));
  }, []);

  const setEventNames = useCallback((eventKey: string, eventName: string) => {
    setEventKey(eventKey);
    setEventName(eventName);
  }, []);

  /**
   * This hook is in charge of setting readyToSend to true after a delay after initial mounting
   */
  useEffect(() => {
    if (!organization) {
      return () => {};
    }
    // after the context first loads, we need to wait DELAY_TIME_MS
    // before we send the analytics event
    const timeoutId = window.setTimeout(() => {
      if (!hasSentAnalytics) {
        setReadyToSend(true);
      }
    }, DELAY_TIME_MS);
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [organization, analyticsParams, hasSentAnalytics]);

  return {
    setDisableRouteAnalytics,
    setRouteAnalyticsParams,
    setOrganization,
    setEventNames,
    previousUrl,
  };
}
