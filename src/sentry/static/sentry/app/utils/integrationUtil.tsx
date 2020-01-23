import {uniqueId} from 'app/utils/guid';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Organization} from 'app/types';
import {Hooks} from 'app/types/hooks';

const INTEGRATIONS_ANALYTICS_SESSION_KEY = 'integrationsAnalyticsSession';

export const startAnalyticsSession = () => {
  const sessionId = uniqueId();
  window.sessionStorage.setItem(INTEGRATIONS_ANALYTICS_SESSION_KEY, sessionId);
  return sessionId;
};

export const clearAnalyticsSession = () => {
  window.sessionStorage.removeItem(INTEGRATIONS_ANALYTICS_SESSION_KEY);
};

export const getAnalyticsSessionId = () => {
  return window.sessionStorage.getItem(INTEGRATIONS_ANALYTICS_SESSION_KEY);
};

type ModalOpenEvent = {
  eventKey: 'integrations.install_modal_opened';
  eventName: 'Integrations: Install Modal Opened';
  already_installed: boolean; //need this field for the modal open event but not other events
};

type OtherSingleIntegrationEvents = {
  eventKey:
    | 'integrations.installation_start'
    | 'integrations.installation_complete'
    | 'integrations.details_viewed'
    | 'integrations.uninstall_clicked'
    | 'integrations.uninstall_completed';
  eventName:
    | 'Integrations: Installation Start'
    | 'Integrations: Installation Complete'
    | 'Integrations: Details Viewed'
    | 'Integrations: Uninstall Clicked'
    | 'Integrations: Uninstall Completed';
};

type SingleIntegrationEvent = (ModalOpenEvent | OtherSingleIntegrationEvents) & {
  integration: string; //the slug
  integration_type: 'sentry_app' | 'plugin' | 'first_party';
};

//TODO(Steve): hook up events
type MultipleIntegrationsEvent = {
  eventKey: 'integrations.index_viewed';
  eventName: 'Integrations: Index Page Viewed';
  integrations_installed: number;
};

type IntegrationsEventParams = (MultipleIntegrationsEvent | SingleIntegrationEvent) & {
  view?:
    | 'external_install'
    | 'integrations_page'
    | 'legacy_integrations'
    | 'integrations_directory';
} & Parameters<Hooks['analytics:track-event']>[0];

/**
 * Tracks an event for ecosystem analytics
 * Must be tied to an organization
 * Uses the current session ID or generates a new one if startSession == true
 */
export const trackIntegrationEvent = (
  analtyicsParams: IntegrationsEventParams,
  org?: Organization, //we should pass in org whenever we can but not every place guarantees this
  options?: {startSession: boolean}
) => {
  const {startSession} = options || {};
  const sessionId = startSession ? startAnalyticsSession() : getAnalyticsSessionId();
  const fullParams = {
    analytics_session_id: sessionId,
    organization_id: org?.id,
    role: org?.role,
    integration_directory_active: false, //TODO: should be configurable
    ...analtyicsParams,
  };

  //TODO(steve): remove once we pass in org always
  if (!org) {
    // eslint-disable-next-line no-console
    console.warn(`Organization absent from event ${analtyicsParams.eventName}`);
  }

  //could put this into a debug method or for the main trackAnalyticsEvent event
  if (window.localStorage.getItem('DEBUG') === '1') {
    // eslint-disable-next-line no-console
    console.log('trackIntegrationEvent', fullParams);
  }
  return trackAnalyticsEvent(fullParams);
};
