import * as qs from 'query-string';

import {CUSTOM_REFERRER_KEY} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import type {Hooks} from 'sentry/types/hooks';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {uniqueId} from 'sentry/utils/guid';
import localStorage from 'sentry/utils/localStorage';
import sessionStorage from 'sentry/utils/sessionStorage';
import {readStorageValue} from 'sentry/utils/useSessionStorage';

import type {Subscription} from 'getsentry/types';
import {hasNewBillingUI} from 'getsentry/utils/billing';
import {GETSENTRY_EVENT_MAP} from 'getsentry/utils/trackGetsentryAnalytics';

import trackAmplitudeEvent from './trackAmplitudeEvent';
import trackMarketingEvent from './trackMarketingEvent';
import trackPendoEvent from './trackPendoEvent';
import trackReloadEvent from './trackReloadEvent';

/**
 * Fields that are listed here which are passed to trackAnalyticsEvent's data
 * will automatically be coerced into integers.
 */
const COERCE_FIELDS = ['project_id', 'organization_id', 'user_id', 'org_id'];

function coerceNumber(value: string | undefined | null) {
  const originalValue = value;

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  // Attempt to coerce the value to a number
  const numberValue = Number(value);

  // Still unable to coerce to a number? that's a failure
  if (isNaN(numberValue)) {
    throw new Error(`Unable to coerce value to number: '${originalValue}'`);
  }

  return numberValue;
}

const MARKETING_EVENT_NAMES = new Set([
  'Growth: Onboarding Load Choose Platform Page',
  'Growth: Onboarding Choose Platform',
  'Growth: Onboarding Start Onboarding',
  'Growth: Onboarding View Sample Event',
  'Growth: Onboarding Click Set Up Your Project',
  'Growth: Onboarding Take to Error',
  'Growth: Onboarding Clicked Need Help',
]);

const ANALYTICS_SESSION = 'ANALYTICS_SESSION';

const startAnalyticsSession = () => {
  const sessionId = uniqueId();
  sessionStorage.setItem(ANALYTICS_SESSION, sessionId);
  return sessionId;
};

const getAnalyticsSessionId = () => sessionStorage.getItem(ANALYTICS_SESSION);

const hasAnalyticsDebug = () => localStorage.getItem('DEBUG_ANALYTICS_GETSENTRY') === '1';

const getCustomReferrer = () => {
  try {
    // pull the referrer from the query parameter of the page
    const {referrer} = qs.parse(window.location.search) || {};
    // pull the referrer from session storage.
    const storedReferrer = readStorageValue<string | null>(CUSTOM_REFERRER_KEY, null);
    // ?referrer takes precedence, but still unset session stored referrer.
    if (storedReferrer) {
      sessionStorage.removeItem(CUSTOM_REFERRER_KEY);
    }
    if (referrer && typeof referrer === 'string') {
      return referrer;
    }
    return storedReferrer;
  } catch {
    // ignore if this fails to parse
    // this can happen if we have an invalid query string
    // e.g. unencoded "%"
  }
  return undefined;
};

const getOrganizationId = (
  organization: Organization | string | null
): number | undefined | null => {
  // this should never happen but there are components that use withOrganization
  // that might end up with an undefined org if used incorrectly
  if (organization === undefined) {
    // eslint-disable-next-line no-console
    console.warn('Unexpected undefined organization');
    return undefined;
  }
  if (typeof organization === 'string') {
    const orgId = Number(organization);
    if (isNaN(orgId)) {
      // eslint-disable-next-line no-console
      console.warn(`Invalid organization ID: ${organization}`);
      return undefined;
    }
    return orgId;
  }
  // if organization is null, organization_id needs to be null
  return organization === null ? null : Number(organization.id);
};

const getOrganizationAge = (
  organization: Organization | string | null
): number | null => {
  if (typeof organization === 'string') {
    return null;
  }
  if (typeof organization?.dateCreated === 'string') {
    const orgAge = getDaysSinceDate(organization?.dateCreated);
    return orgAge;
  }
  return null;
};

const getUserAge = (user: User): number => {
  return getDaysSinceDate(user.dateJoined);
};
type RawTrackEventHook = Hooks['analytics:raw-track-event'];
type Params = Parameters<RawTrackEventHook>[0] & {
  subscription?: Subscription;
};

type Options = Parameters<RawTrackEventHook>[1];

/**
 * Returns true if the organization input has all the properties of a full organization
 */
function isFullOrganization(
  organization: Params['organization']
): organization is Organization {
  return !!organization && typeof organization !== 'string';
}

export default function rawTrackAnalyticsEvent(
  {eventKey, eventName, organization, subscription, ...data}: Params,
  options?: Options
) {
  try {
    // apply custom function map parameters
    const {mapValuesFn} = options || {};
    if (mapValuesFn) {
      data = mapValuesFn(data);
    }
    const time = options?.time;

    const organization_id = getOrganizationId(organization);

    // Coerce number fields
    Object.keys(data)
      .filter(field => COERCE_FIELDS.includes(field))
      .forEach(field => (data[field] = coerceNumber(data[field])));

    let sessionId = options?.startSession
      ? startAnalyticsSession()
      : getAnalyticsSessionId();
    // we should always have a session id but if we don't, we should generate one
    if (!sessionId) {
      sessionId = startAnalyticsSession();
    }
    data.analytics_session_id = sessionId;

    // add custom referrer if available
    const customReferrer = getCustomReferrer();
    if (customReferrer) {
      data.custom_referrer = customReferrer;
    }

    // add in previous referrer if different than custom referrer
    const prevReferrer = sessionStorage.getItem('previous_referrer');
    if (prevReferrer && prevReferrer !== customReferrer) {
      data.previous_referrer = prevReferrer;
    }

    // pass in properties if we have the full organization
    if (isFullOrganization(organization)) {
      data.role = organization.orgRole;

      if (eventKey in GETSENTRY_EVENT_MAP) {
        data.isNewCheckout = true;
        data.isNewBillingUI = hasNewBillingUI(organization);
      }
    }

    // add in plan information
    if (subscription) {
      data.plan = data.plan || subscription.plan;
      if (data.can_trial === undefined) {
        data.can_trial = subscription.canTrial;
      }
      if (data.is_trial === undefined) {
        data.is_trial = subscription.isTrial;
      }
      // we can add more fields but we should be carefull about which ones to add
      // since Amplitude is an external vendor
    }

    // debug mode will console.log the event parameters
    if (hasAnalyticsDebug()) {
      // eslint-disable-next-line no-console
      console.log('rawTrackAnalyticsEvent', {eventKey, eventName, ...data});
    }

    // Prepare reloads data payload. If the organization_id is passed we include
    // that in the data payload.
    const user = ConfigStore.get('user');
    const reloadData = {
      user_id: coerceNumber(user?.id),
      org_id: organization_id,
      allow_no_schema: true,
      sent_at: (time || Date.now()).toString(),
      ...data,
    };

    trackReloadEvent(eventKey, reloadData);
    if (eventName && organization_id !== undefined) {
      const orgAge = getOrganizationAge(organization);
      const userAge = getUserAge(user);

      // add in url for amplitude events as reload has it automatically added
      const dataWithUrl = {
        url: window.location.href,
        user_age: userAge,
        organization_age: orgAge,
        ...data,
      };
      trackAmplitudeEvent(eventName, organization_id, dataWithUrl, {time});
      trackPendoEvent(eventName, data);
    }
    // using the eventName for marketing event names
    if (eventName && MARKETING_EVENT_NAMES.has(eventName)) {
      trackMarketingEvent(eventName, {plan: subscription?.plan});
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error tracking analytics event', err);
  }
}
