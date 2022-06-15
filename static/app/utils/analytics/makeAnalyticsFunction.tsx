import type {Hooks} from 'sentry/types/hooks';
import {trackAnalyticsEventV2} from 'sentry/utils/analytics';

import {Organization} from '../../types/organization';

import type {AnalyticsEventParameters} from './trackAdvancedAnalyticsEvent';

const hasAnalyticsDebug = () => window.localStorage?.getItem('DEBUG_ANALYTICS') === '1';

type Options = Parameters<Hooks['analytics:track-event-v2']>[1];

/**
 * Generates functions used to track an event for analytics.
 * Each function can only handle the event types specified by the
 * generic for EventParameters and the events in eventKeyToNameMap.
 * Can specifcy default options with the defaultOptions argument as well.
 * Can make orgnization required with the second generic.
 */
// type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

type AnalyticsParams<K extends keyof AnalyticsEventParameters> = Omit<
  AnalyticsEventParameters[K],
  'eventName' | 'eventKey'
> & {organization: string | null | Organization};

export default function makeAnalyticsFunction(
  eventKeyToNameMap: Record<keyof AnalyticsEventParameters, string | null>,
  defaultOptions?: Options
) {
  /**
   * Function used for analytics of specifc types determined from factory function
   * Uses the current session ID or generates a new one if startSession == true.
   * An analytics session corresponds to a single action funnel such as installation.
   * Tracking by session allows us to track individual funnel attempts for a single user.
   */
  return <K extends keyof AnalyticsEventParameters>(
    eventKey: K,
    analyticsParams: AnalyticsParams<K>,
    options?: Options
  ) => {
    const params = {
      eventKey,
      eventName: eventKeyToNameMap[eventKey],
      ...analyticsParams,
    };

    if (hasAnalyticsDebug()) {
      // eslint-disable-next-line no-console
      console.log('analyticsEvent', params);
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
