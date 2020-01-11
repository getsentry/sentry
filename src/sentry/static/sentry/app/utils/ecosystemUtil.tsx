import {uniqueId} from 'app/utils/guid';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Organization} from 'app/types';
import {Hooks} from 'app/types/hooks';

const ECOSYSTEM_ANALYTICS_SESSION_KEY = 'ecosystemAnalyticsSession';

export const startAnalyticsSession = () => {
  const sessionId = uniqueId();
  window.sessionStorage.setItem(ECOSYSTEM_ANALYTICS_SESSION_KEY, sessionId);
  return sessionId;
};

export const clearAnalyticsSession = () => {
  window.sessionStorage.removeItem(ECOSYSTEM_ANALYTICS_SESSION_KEY);
};

export const getAnalyticsSessionId = () => {
  return window.sessionStorage.getItem(ECOSYSTEM_ANALYTICS_SESSION_KEY);
};

type SingleIntegrationEvent = {
  eventKey: 'integrations.install_modal_opened';
  eventName: 'Integrations: Install Modal Opened';
  integration: string; //the slug
  integration_type: 'sentry_app' | 'plugin' | 'first_party';
  already_installed: boolean;
};

type MultipleIntegrationsEvent = {
  integrations_installed: number;
};

type EcosystemEventParams = (MultipleIntegrationsEvent | SingleIntegrationEvent) & {
  view?: 'external_install' | 'integrations_page' | 'legacy_integrations';
} & Parameters<Hooks['analytics:track-event']>[0];

/**
 * Tracks an event for ecosystem analytics
 * Must be tied to an organization
 * Uses the current session ID or generates a new one if startSession == true
 */
export const trackEcosystemEvent = (
  analtyicsParams: EcosystemEventParams,
  org: Organization,
  options?: {startSession: boolean}
) => {
  const {startSession} = options || {};
  const sessionId = startSession ? startAnalyticsSession() : getAnalyticsSessionId();
  const fullParams = {
    analytics_session_id: sessionId,
    organization_id: org.id,
    role: org.role,
    ...analtyicsParams,
  };
  //could put this into a debug method or for the main trackAnalyticsEvent event
  if (window.localStorage.getItem('DEBUG') === '1') {
    // eslint-disable-next-line no-console
    console.log('trackEcosystemEvent', fullParams);
  }
  return trackAnalyticsEvent(fullParams);
};
