import * as Amplitude from '@amplitude/analytics-browser';
import * as Sentry from '@sentry/react';
import {parseAsJson} from 'nuqs';
import * as qs from 'query-string';
import {z} from 'zod';

import {ConfigStore} from 'sentry/stores/configStore';
import type {User} from 'sentry/types/user';
import {toArray} from 'sentry/utils/array/toArray';
import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';

import {trackMarketingEvent} from 'getsentry/utils/trackMarketingEvent';

const MARKETING_EVENT_SESSION_KEY = 'marketing_event_recorded';

const marketingEventSchema = z.object({
  event_name: z.string().min(1),
  event_label: z.string().optional(),
});

const parseAsMarketingEvents = parseAsJson(toArray);

/**
 * This function initializes the user for analytics (Amplitude)
 * It also handles other initialization logic for analytics like sending
 * events to Google Analytics and storing the previous_referrer into local storage
 */
export function analyticsInitUser(user: User) {
  const {frontend_events, referrer} = qs.parse(window.location.search) || {};
  // store the referrer in sessionStorage so we know what it was when the user
  // navigates to another page
  if (referrer && typeof referrer === 'string') {
    sessionStorageWrapper.setItem('previous_referrer', referrer);
  }
  // quit early if analytics is disabled
  if (!ConfigStore.get('enableAnalytics')) {
    return;
  }

  const amplitudeKey = ConfigStore.get('getsentry.amplitudeApiKey');
  if (!amplitudeKey) {
    return;
  }

  Amplitude.init(amplitudeKey, undefined, {
    logLevel: Amplitude.Types.LogLevel.None,
    minIdLength: 1,
    attribution: {
      disabled: false,
    },
    trackingOptions: {
      city: false,
      ip_address: false,
      dma: false,
    },
  });

  // Most of our in-app amplitude logging happens on the backend, whereas anonymous user tracking
  // happens in the JS SDK. This means when a user signs up, we need to somehow link their
  // anonymous activity with their in-app activity. Logging a dummy event from the JS SDK in-app
  // accomplishes that.
  const identify = new Amplitude.Identify();
  const identifyObj = identify
    .set('user_id', user.id)
    .set('lastAppPageLoad', new Date().toISOString())
    .set(
      'isInternalUser',
      user.identities.some(ident => ident.organization?.slug === 'sentry') ||
        user.emails.some(email => email.email?.endsWith('sentry.io')) || // Has a sentry.io email
        user.isSuperuser // Has an identity for the Sentry organization.
    );

  // pass in timestamp from this moment instead of letting Amplitude determine it
  // which is roughly 100 ms later
  Amplitude.identify(identifyObj, {time: Date.now()});

  // the backend can send any arbitrary marketing events
  if (frontend_events && typeof frontend_events === 'string') {
    // if we've already recorded this event for this session, we don't need to record it again
    // this helps prevent duplicate events from mulitiple refreshes
    if (sessionStorageWrapper.getItem(MARKETING_EVENT_SESSION_KEY) === frontend_events) {
      return;
    }
    try {
      const events = parseAsMarketingEvents.parse(frontend_events);
      if (events === null) {
        throw new Error('Invalid frontend_events JSON');
      }
      events.forEach(event => {
        const result = marketingEventSchema.safeParse(event);
        if (!result.success) {
          // eslint-disable-next-line no-console
          console.warn('Invalid frontend_events event', event);
          return;
        }
        const {event_name, event_label} = result.data;
        trackMarketingEvent(event_name, {event_label});
      });
    } catch (err) {
      Sentry.captureException(err);
    }
    sessionStorageWrapper.setItem(MARKETING_EVENT_SESSION_KEY, frontend_events);
  }
}
