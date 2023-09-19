import {Organization} from 'sentry/types';
import {Hooks} from 'sentry/types/hooks';
import {rawTrackAnalyticsEvent} from 'sentry/utils/analytics';

const hasAnalyticsDebug = () => window.localStorage?.getItem('DEBUG_ANALYTICS') === '1';

type OptionalOrg = {
  organization: Organization | string | null;
};
type Options = Parameters<Hooks['analytics:raw-track-event']>[1];

/**
 * Generates functions used to track an event for analytics.
 * Each function can only handle the event types specified by the
 * generic for EventParameters and the events in eventKeyToNameMap.
 * Can specifcy default options with the defaultOptions argument as well.
 * Can make orgnization required with the second generic.
 */
export default function makeAnalyticsFunction<
  EventParameters extends Record<string, Record<string, any>>,
  OrgRequirement extends OptionalOrg = OptionalOrg,
>(
  eventKeyToNameMap: Record<keyof EventParameters, string | null>,
  defaultOptions?: Options
) {
  /**
   * Function used for analytics of specifc types determined from factory function
   * Uses the current session ID or generates a new one if startSession == true.
   * An analytics session corresponds to a single action funnel such as installation.
   * Tracking by session allows us to track individual funnel attempts for a single user.
   */
  return <EventKey extends keyof EventParameters & string>(
    eventKey: EventKey,
    analyticsParams: EventParameters[EventKey] & OrgRequirement,
    options?: Options
  ) => {
    const eventName = eventKeyToNameMap[eventKey];
    const params = {
      eventKey,
      eventName,
      ...analyticsParams,
    };

    if (hasAnalyticsDebug()) {
      // eslint-disable-next-line no-console
      console.log('analyticsEvent', params);
    }

    // only apply options if required to make mock assertions easier
    if (options || defaultOptions) {
      options = {...defaultOptions, ...options};
      rawTrackAnalyticsEvent(params, options);
    } else {
      rawTrackAnalyticsEvent(params);
    }
  };
}
