import * as qs from 'query-string';

import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {growthEventMap, GrowthEventParameters} from 'app/utils/growthAnalyticsEvents';
import {uniqueId} from 'app/utils/guid';
import {
  integrationEventMap,
  IntegrationEventParameters,
} from 'app/utils/integrationEvents';

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

export type EventParameters = IntegrationEventParameters & GrowthEventParameters;

const allEventMap = {...integrationEventMap, ...growthEventMap};

type AnalyticsKey = keyof EventParameters;

/**
 * Tracks an event for analytics.
 * Must be tied to an organization.
 * Uses the current session ID or generates a new one if startSession == true.
 * An analytics session corresponds to a single action funnel such as installation.
 * Tracking by session allows us to track individual funnel attempts for a single user.
 */
export function trackAdvancedAnalyticsEvent<T extends AnalyticsKey>(
  eventKey: T,
  analyticsParams: EventParameters[T],
  org: Organization | null, // if org is undefined, event won't be recorded
  options?: {startSession: boolean},
  mapValuesFn?: (params: object) => object
) {
  try {
    const {startSession} = options || {};
    let sessionId = startSession ? startAnalyticsSession() : getAnalyticsSessionId();

    const eventName = allEventMap[eventKey];

    // we should always have a session id but if we don't, we should generate one
    if (hasAnalyticsDebug() && !sessionId) {
      // eslint-disable-next-line no-console
      console.warn(`analytics_session_id absent from event ${eventKey}`);
      sessionId = startAnalyticsSession();
    }

    let custom_referrer: string | undefined;

    try {
      // pull the referrer from the query parameter of the page
      const {referrer} = qs.parse(window.location.search) || {};
      if (typeof referrer === 'string') {
        // Amplitude has its own referrer which inteferes with our custom referrer
        custom_referrer = referrer;
      }
    } catch {
      // ignore if this fails to parse
      // this can happen if we have an invalid query string
      // e.g. unencoded "%"
    }

    // if org is null, we want organization_id to be null
    const organization_id = org ? org.id : org;

    let params = {
      eventKey,
      eventName,
      analytics_session_id: sessionId,
      organization_id,
      role: org?.role,
      custom_referrer,
      ...analyticsParams,
    };
    if (mapValuesFn) {
      params = mapValuesFn(params) as any;
    }

    // could put this into a debug method or for the main trackAnalyticsEvent event
    if (hasAnalyticsDebug()) {
      // eslint-disable-next-line no-console
      console.log('trackAdvancedAnalytics', params);
    }
    trackAnalyticsEvent(params);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Error tracking analytics event', e);
  }
}
