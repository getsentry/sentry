import {LightWeightOrganization} from 'app/types';
import {Hooks} from 'app/types/hooks';
import {trackAnalyticsEventV2} from 'app/utils/analytics';
import {growthEventMap, GrowthEventParameters} from 'app/utils/growthAnalyticsEvents';
import {uniqueId} from 'app/utils/guid';
import {
  integrationEventMap,
  IntegrationEventParameters,
} from 'app/utils/integrationEvents';
import {issueEventMap, IssueEventParameters} from 'app/utils/issueEvents';
import {
  performanceEventMap,
  PerformanceEventParameters,
} from 'app/utils/performanceEvents';

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

export type EventParameters = IntegrationEventParameters &
  GrowthEventParameters &
  IssueEventParameters &
  PerformanceEventParameters;

const allEventMap = {
  ...integrationEventMap,
  ...growthEventMap,
  ...issueEventMap,
  ...performanceEventMap,
};

type AnalyticsKey = keyof EventParameters;

type OptionalOrg = {organization: LightWeightOrganization | null};

/**
 * Tracks an event for analytics.
 * Must be tied to an organization.
 * Uses the current session ID or generates a new one if startSession == true.
 * An analytics session corresponds to a single action funnel such as installation.
 * Tracking by session allows us to track individual funnel attempts for a single user.
 */
export function trackAdvancedAnalyticsEvent<T extends AnalyticsKey>(
  eventKey: T,
  analyticsParams: EventParameters[T] & OptionalOrg,
  options?: Parameters<Hooks['analytics:track-event-v2']>[1]
) {
  const eventName = allEventMap[eventKey];

  // need to destructure the org here to make TS happy
  const {organization, ...rest} = analyticsParams;
  const params = {
    eventKey,
    eventName,
    organization,
    ...rest,
  };

  // could put this into a debug method or for the main trackAnalyticsEvent event
  if (hasAnalyticsDebug()) {
    // eslint-disable-next-line no-console
    console.log('trackAdvancedAnalytics', params);
  }

  // only apply options if required to make mock assertions easier
  if (options) {
    trackAnalyticsEventV2(params, options);
  } else {
    trackAnalyticsEventV2(params);
  }
}
