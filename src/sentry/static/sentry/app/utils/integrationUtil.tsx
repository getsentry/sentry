import capitalize from 'lodash/capitalize';
import React from 'react';
import * as qs from 'query-string';

import HookStore from 'app/stores/hookStore';
import {
  AppOrProviderOrPlugin,
  DocumentIntegration,
  Integration,
  IntegrationFeature,
  IntegrationInstallationStatus,
  IntegrationProvider,
  IntegrationType,
  Organization,
  PluginWithProjectList,
  SentryApp,
  SentryAppInstallation,
  SentryAppStatus,
} from 'app/types';
import {Hooks} from 'app/types/hooks';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {uniqueId} from 'app/utils/guid';

const INTEGRATIONS_ANALYTICS_SESSION_KEY = 'INTEGRATION_ANALYTICS_SESSION' as const;

const FEATURES_TO_INCLUDE_IN_ANALYTICS = ['slack-migration'];

export const startAnalyticsSession = () => {
  const sessionId = uniqueId();
  window.sessionStorage.setItem(INTEGRATIONS_ANALYTICS_SESSION_KEY, sessionId);
  return sessionId;
};

export const clearAnalyticsSession = () => {
  window.sessionStorage.removeItem(INTEGRATIONS_ANALYTICS_SESSION_KEY);
};

export const getAnalyticsSessionId = () =>
  window.sessionStorage.getItem(INTEGRATIONS_ANALYTICS_SESSION_KEY);

export type SingleIntegrationEvent = {
  eventKey:
    | 'integrations.install_modal_opened' //TODO: remove
    | 'integrations.installation_start'
    | 'integrations.installation_complete'
    | 'integrations.integration_viewed' //for the integration overview
    | 'integrations.details_viewed' //for an individual configuration
    | 'integrations.uninstall_clicked'
    | 'integrations.uninstall_completed'
    | 'integrations.enabled'
    | 'integrations.disabled'
    | 'integrations.config_saved'
    | 'integrations.integration_tab_clicked'
    | 'integrations.plugin_add_to_project_clicked'
    | 'integrations.upgrade_plan_modal_opened'
    | 'integrations.resolve_now_clicked'
    | 'integrations.reauth_start'
    | 'integrations.reauth_complete'
    | 'integrations.request_install';
  eventName:
    | 'Integrations: Install Modal Opened' //TODO: remove
    | 'Integrations: Installation Start'
    | 'Integrations: Installation Complete'
    | 'Integrations: Integration Viewed'
    | 'Integrations: Details Viewed'
    | 'Integrations: Uninstall Clicked'
    | 'Integrations: Uninstall Completed'
    | 'Integrations: Enabled'
    | 'Integrations: Disabled'
    | 'Integrations: Integration Tab Clicked'
    | 'Integrations: Config Saved'
    | 'Integrations: Plugin Add to Project Clicked'
    | 'Integrations: Upgrade Plan Modal Opened'
    | 'Integrations: Resolve Now Clicked'
    | 'Integrations: Reauth Start'
    | 'Integrations: Reauth Complete'
    | 'Integrations: Request Install';
  integration: string; //the slug
  integration_type: IntegrationType;
  already_installed?: boolean;
  integration_tab?: 'configurations' | 'overview';
  plan?: string;
  //include the status since people might do weird things testing unpublished integrations
  integration_status?: SentryAppStatus;
};

type MultipleIntegrationsEvent = {
  eventKey: 'integrations.index_viewed';
  eventName: 'Integrations: Index Page Viewed';
  integrations_installed: number;
};

type IntegrationSearchEvent = {
  eventKey: 'integrations.directory_item_searched';
  eventName: 'Integrations: Directory Item Searched';
  search_term: string;
  num_results: number;
};

type IntegrationCategorySelectEvent = {
  eventKey: 'integrations.directory_category_selected';
  eventName: 'Integrations: Directory Category Selected';
  category: string;
};

type IntegrationsEventParams = (
  | MultipleIntegrationsEvent
  | SingleIntegrationEvent
  | IntegrationSearchEvent
  | IntegrationCategorySelectEvent
) & {
  view?:
    | 'external_install'
    | 'legacy_integrations'
    | 'plugin_details'
    | 'integrations_directory'
    | 'integrations_directory_integration_detail';
  project_id?: string;
} & Parameters<Hooks['analytics:track-event']>[0];

const hasAnalyticsDebug = () =>
  window.localStorage.getItem('DEBUG_INTEGRATION_ANALYTICS') === '1';

/**
 * Tracks an event for ecosystem analytics
 * Must be tied to an organization
 * Uses the current session ID or generates a new one if startSession == true
 */
export const trackIntegrationEvent = (
  analyticsParams: IntegrationsEventParams,
  org?: Organization, //we should pass in org whenever we can but not every place guarantees this
  options?: {startSession: boolean}
) => {
  const {startSession} = options || {};
  let sessionId = startSession ? startAnalyticsSession() : getAnalyticsSessionId();

  //we should always have a session id but if we don't, we should generate one
  if (hasAnalyticsDebug() && !sessionId) {
    // eslint-disable-next-line no-console
    console.warn(`analytics_session_id absent from event ${analyticsParams.eventName}`);
    sessionId = startAnalyticsSession();
  }

  let features = {};
  if (org) {
    features = Object.fromEntries(
      FEATURES_TO_INCLUDE_IN_ANALYTICS.map(f => [
        `feature-${f}`,
        org.features.includes(f),
      ])
    );
  }

  let custom_referrer: string | undefined;

  try {
    //pull the referrer from the query parameter of the page
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

  const params = {
    analytics_session_id: sessionId,
    organization_id: org?.id,
    role: org?.role,
    custom_referrer,
    ...features,
    ...analyticsParams,
  };

  //add the integration_status to the type of params so TS doesn't complain about what we do below
  const fullParams: typeof params & {
    integration_status?: SentryAppStatus;
  } = params;

  //Reload expects integration_status even though it's not relevant for non-sentry apps
  //Passing in a dummy value of published in those cases
  if (analyticsParams.integration && analyticsParams.integration_type !== 'sentry_app') {
    fullParams.integration_status = 'published';
  }

  //TODO(steve): remove once we pass in org always
  if (hasAnalyticsDebug() && !org) {
    // eslint-disable-next-line no-console
    console.warn(`Organization absent from event ${analyticsParams.eventName}`);
  }

  //could put this into a debug method or for the main trackAnalyticsEvent event
  if (hasAnalyticsDebug()) {
    // eslint-disable-next-line no-console
    console.log('trackIntegrationEvent', fullParams);
  }

  return trackAnalyticsEvent(fullParams);
};

/**
 * In sentry.io the features list supports rendering plan details. If the hook
 * is not registered for rendering the features list like this simply show the
 * features as a normal list.
 */
const generateFeaturesList = p => (
  <ul>
    {p.features.map((f, i) => (
      <li key={i}>{f.description}</li>
    ))}
  </ul>
);

const generateIntegrationFeatures = p =>
  p.children({
    disabled: false,
    disabledReason: null,
    ungatedFeatures: p.features,
    gatedFeatureGroups: [],
  });

const defaultFeatureGateComponents = {
  IntegrationFeatures: generateIntegrationFeatures,
  IntegrationDirectoryFeatures: generateIntegrationFeatures,
  FeatureList: generateFeaturesList,
  IntegrationDirectoryFeatureList: generateFeaturesList,
} as ReturnType<Hooks['integrations:feature-gates']>;

export const getIntegrationFeatureGate = () => {
  const defaultHook = () => defaultFeatureGateComponents;
  const featureHook = HookStore.get('integrations:feature-gates')[0] || defaultHook;
  return featureHook();
};

export const getSentryAppInstallStatus = (install: SentryAppInstallation | undefined) => {
  if (install) {
    return capitalize(install.status) as IntegrationInstallationStatus;
  }
  return 'Not Installed';
};

export const getCategories = (features: IntegrationFeature[]): string[] => {
  const transform = features.map(({featureGate}) => {
    const feature = featureGate
      .replace(/integrations/g, '')
      .replace(/-/g, ' ')
      .trim();
    switch (feature) {
      case 'actionable notification':
        return 'notification action';
      case 'issue basic':
      case 'issue sync':
        return 'project management';
      case 'commits':
        return 'source code management';
      case 'chat unfurl':
        return 'chat';
      default:
        return feature;
    }
  });

  return [...new Set(transform)];
};

export const getCategoriesForIntegration = (
  integration: AppOrProviderOrPlugin
): string[] => {
  if (isSentryApp(integration)) {
    return ['internal', 'unpublished'].includes(integration.status)
      ? [integration.status]
      : getCategories(integration.featureData);
  }
  if (isPlugin(integration)) {
    return getCategories(integration.featureDescriptions);
  }
  if (isDocumentIntegration(integration)) {
    return getCategories(integration.features);
  }
  return getCategories(integration.metadata.features);
};

export function isSentryApp(
  integration: AppOrProviderOrPlugin
): integration is SentryApp {
  return !!(integration as SentryApp).uuid;
}

export function isPlugin(
  integration: AppOrProviderOrPlugin
): integration is PluginWithProjectList {
  return integration.hasOwnProperty('shortName');
}

export function isDocumentIntegration(
  integration: AppOrProviderOrPlugin
): integration is DocumentIntegration {
  return integration.hasOwnProperty('docUrl');
}

export function isSlackWorkspaceApp(integration: Integration) {
  return integration.configData.installationType === 'workspace_app';
}

//returns the text in the alert asking the user to re-authenticate a first-party integration
export function getReauthAlertText(provider: IntegrationProvider) {
  return provider.metadata.aspects?.reauthentication_alert?.alertText;
}

export const convertIntegrationTypeToSnakeCase = (
  type: 'plugin' | 'firstParty' | 'sentryApp' | 'documentIntegration'
) => {
  switch (type) {
    case 'firstParty':
      return 'first_party';
    case 'sentryApp':
      return 'sentry_app';
    case 'documentIntegration':
      return 'document';
    default:
      return type;
  }
};
