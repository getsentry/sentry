import {LightWeightOrganization} from 'app/types';
import {Hooks} from 'app/types/hooks';
import {trackAnalyticsEventV2} from 'app/utils/analytics';
import {uniqueId} from 'app/utils/guid';

const ANALYTICS_SESSION = 'ANALYTICS_SESSION';

export const startAnalyticsSession = () => {
  const sessionId = uniqueId();
  window.sessionStorage.setItem(ANALYTICS_SESSION, sessionId);
  return sessionId;
};

export const clearAnalyticsSession = () => {
  window.sessionStorage.removeItem(ANALYTICS_SESSION);
};

export const getAnalyticsSessionId = () =>
  window.sessionStorage.getItem(ANALYTICS_SESSION);

const hasAnalyticsDebug = () => window.localStorage.getItem('DEBUG_ANALYTICS') === '1';

type OptionalOrg = {organization: LightWeightOrganization | null};
type Options = Parameters<Hooks['analytics:track-event-v2']>[1];

export default function analyticsFactory<
  EventParameters extends Record<string, Record<string, any>>
>(
  eventKeyToNameMap: Record<keyof EventParameters, string | null>,
  defaultOptions?: Options
) {
  return <EventKey extends keyof EventParameters & string>(
    eventKey: EventKey,
    analyticsParams: EventParameters[EventKey] & OptionalOrg,
    options?: Options
  ) => {
    const eventName = eventKeyToNameMap[eventKey];

    const params = {
      eventKey,
      eventName,
      ...analyticsParams,
    };

    // could put this into a debug method or for the main trackAnalyticsEvent event
    if (hasAnalyticsDebug()) {
      // eslint-disable-next-line no-console
      console.log('trackAdvancedAnalytics', params);
    }

    // only apply options if required to make mock assertions easier
    if (options || defaultOptions) {
      options = {...defaultOptions, ...options};
      trackAnalyticsEventV2(params, options);
    } else {
      trackAnalyticsEventV2(params);
    }
  };
}
