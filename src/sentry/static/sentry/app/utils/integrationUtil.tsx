import React from 'react';
import capitalize from 'lodash/capitalize';
import * as qs from 'query-string';

import {
  IconBitbucket,
  IconGeneric,
  IconGithub,
  IconGitlab,
  IconJira,
  IconVsts,
} from 'app/icons';
import HookStore from 'app/stores/hookStore';
import {
  AppOrProviderOrPlugin,
  DocumentIntegration,
  IntegrationFeature,
  IntegrationInstallationStatus,
  IntegrationType,
  Organization,
  PlatformType,
  PluginWithProjectList,
  SentryApp,
  SentryAppInstallation,
  SentryAppStatus,
} from 'app/types';
import {Hooks} from 'app/types/hooks';
import {trackAdvancedAnalyticsEvent} from 'app/utils/advancedAnalytics';

//define the various event paylaods
type View = {
  view?:
    | 'external_install'
    | 'legacy_integrations'
    | 'plugin_details'
    | 'integrations_directory'
    | 'integrations_directory_integration_detail'
    | 'stacktrace_issue_details'
    | 'integration_configuration_detail'
    | 'onboarding'
    | 'project_creation';
};

type SingleIntegrationEventParams = {
  integration: string; //the slug
  integration_type: IntegrationType;
  already_installed?: boolean;
  plan?: string;
  //include the status since people might do weird things testing unpublished integrations
  integration_status?: SentryAppStatus;
  integration_tab?: 'configurations' | 'overview';
} & View;

type MultipleIntegrationsEventParams = {
  integrations_installed: number;
} & View;

type IntegrationSearchEventParams = {
  search_term: string;
  num_results: number;
} & View;

type IntegrationCategorySelectEventParams = {
  category: string;
} & View;

type IntegrationStacktraceLinkEventParams = {
  provider?: string;
  platform?: PlatformType;
  setup_type?: 'automatic' | 'manual';
  error_reason?: 'file_not_found' | 'stack_root_mismatch';
} & View;

type IntegrationServerlessFunctionsViewedParams = {
  num_functions: number;
} & SingleIntegrationEventParams;

type IntegrationServerlessFunctionActionParams = {
  action: 'enable' | 'disable' | 'updateVersion';
} & SingleIntegrationEventParams;

type IntegrationInstalltionInputValueChangeEventParams = {
  field_name: string;
} & SingleIntegrationEventParams;

//define the event key to payload mappings
export type EventParameters = {
  'integrations.install_modal_opened': SingleIntegrationEventParams;
  'integrations.integration_viewed': SingleIntegrationEventParams;
  'integrations.installation_start': SingleIntegrationEventParams;
  'integrations.installation_complete': SingleIntegrationEventParams;
  'integrations.uninstall_clicked': SingleIntegrationEventParams;
  'integrations.uninstall_completed': SingleIntegrationEventParams;
  'integrations.enabled': SingleIntegrationEventParams;
  'integrations.disabled': SingleIntegrationEventParams;
  'integrations.config_saved': SingleIntegrationEventParams;
  'integrations.integration_tab_clicked': SingleIntegrationEventParams;
  'integrations.plugin_add_to_project_clicked': SingleIntegrationEventParams;
  'integrations.resolve_now_clicked': SingleIntegrationEventParams;
  'integrations.request_install': SingleIntegrationEventParams;
  'integrations.code_mappings_viewed': SingleIntegrationEventParams;
  'integrations.details_viewed': SingleIntegrationEventParams; //for an individual configuration
  'integrations.index_viewed': MultipleIntegrationsEventParams;
  'integrations.directory_item_searched': IntegrationSearchEventParams;
  'integrations.directory_category_selected': IntegrationCategorySelectEventParams;
  'integrations.stacktrace_start_setup': IntegrationStacktraceLinkEventParams;
  'integrations.stacktrace_submit_config': IntegrationStacktraceLinkEventParams;
  'integrations.stacktrace_complete_setup': IntegrationStacktraceLinkEventParams;
  'integrations.stacktrace_manual_option_clicked': IntegrationStacktraceLinkEventParams;
  'integrations.stacktrace_link_clicked': IntegrationStacktraceLinkEventParams;
  'integrations.reconfigure_stacktrace_setup': IntegrationStacktraceLinkEventParams;
  'integrations.stacktrace_docs_clicked': IntegrationStacktraceLinkEventParams;
  'integrations.serverless_functions_viewed': IntegrationServerlessFunctionsViewedParams;
  'integrations.installation_input_value_changed': IntegrationInstalltionInputValueChangeEventParams;
  'integrations.serverless_function_action': IntegrationServerlessFunctionActionParams;
  'integrations.cloudformation_link_clicked': SingleIntegrationEventParams;
  'integrations.switch_manual_sdk_setup': SingleIntegrationEventParams;
};

export type AnalyticsKey = keyof EventParameters;

//define the event key to event name mappings
const eventNameMap: Record<AnalyticsKey, string> = {
  'integrations.install_modal_opened': 'Integrations: Install Modal Opened',
  'integrations.integration_viewed': 'Integrations: Integration Viewed',
  'integrations.installation_start': 'Integrations: Installation Start',
  'integrations.installation_complete': 'Integrations: Installation Complete',
  'integrations.uninstall_clicked': 'Integrations: Uninstall Clicked',
  'integrations.uninstall_completed': 'Integrations: Uninstall Completed',
  'integrations.enabled': 'Integrations: Enabled',
  'integrations.disabled': 'Integrations: Disabled',
  'integrations.config_saved': 'Integrations: Config Saved',
  'integrations.integration_tab_clicked': 'Integrations: Integration Tab Clicked',
  'integrations.plugin_add_to_project_clicked':
    'Integrations: Plugin Add to Project Clicked',
  'integrations.resolve_now_clicked': 'Integrations: Resolve Now Clicked',
  'integrations.request_install': 'Integrations: Request Install',
  'integrations.code_mappings_viewed': 'Integrations: Code Mappings Viewed',
  'integrations.details_viewed': 'Integrations: Details Viewed',
  'integrations.index_viewed': 'Integrations: Index Page Viewed',
  'integrations.directory_item_searched': 'Integrations: Directory Item Searched',
  'integrations.directory_category_selected': 'Integrations: Directory Category Selected',
  'integrations.stacktrace_start_setup': 'Integrations: Stacktrace Start Setup',
  'integrations.stacktrace_submit_config': 'Integrations: Stacktrace Submit Config',
  'integrations.stacktrace_complete_setup': 'Integrations: Stacktrace Complete Setup',
  'integrations.stacktrace_manual_option_clicked':
    'Integrations: Stacktrace Manual Option Clicked',
  'integrations.stacktrace_link_clicked': 'Integrations: Stacktrace Link Clicked',
  'integrations.reconfigure_stacktrace_setup':
    'Integrations: Reconfigure Stacktrace Setup',
  'integrations.stacktrace_docs_clicked': 'Integrations: Stacktrace Docs Clicked',

  'integrations.serverless_functions_viewed': 'Integrations: Serverless Functions Viewed',
  'integrations.installation_input_value_changed':
    'Integrations: Installation Input Value Changed',
  'integrations.serverless_function_action': 'Integrations: Serverless Function Action',
  'integrations.cloudformation_link_clicked': 'Integrations: CloudFormation Link Clicked',
  'integrations.switch_manual_sdk_setup': 'Integrations: Switch Manual SDK Setup',
};

//hook to lazyily generate eventNameMap
export const getEventNameMap = () => eventNameMap;

const mapIntegrationParams = analyticsParams => {
  //Reload expects integration_status even though it's not relevant for non-sentry apps
  //Passing in a dummy value of published in those cases
  const fullParams = {...analyticsParams};
  if (analyticsParams.integration && analyticsParams.integration_type !== 'sentry_app') {
    fullParams.integration_status = 'published';
  }
  return fullParams;
};

export function trackIntegrationEvent<T extends AnalyticsKey>(
  eventKey: T,
  analyticsParams: EventParameters[T],
  org?: Organization,
  options?: Parameters<typeof trackAdvancedAnalyticsEvent>[3]
) {
  return trackAdvancedAnalyticsEvent(
    eventKey,
    analyticsParams,
    org,
    options,
    mapIntegrationParams
  );
}

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
      case 'issue link':
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

export const safeGetQsParam = (param: string) => {
  try {
    const query = qs.parse(window.location.search) || {};
    return query[param];
  } catch {
    return undefined;
  }
};

export const getIntegrationIcon = (integrationType?: string, size?: string) => {
  const iconSize = size || 'md';
  switch (integrationType) {
    case 'bitbucket':
      return <IconBitbucket size={iconSize} />;
    case 'gitlab':
      return <IconGitlab size={iconSize} />;
    case 'github':
    case 'github_enterprise':
      return <IconGithub size={iconSize} />;
    case 'jira':
    case 'jira_server':
      return <IconJira size={iconSize} />;
    case 'vsts':
      return <IconVsts size={iconSize} />;
    default:
      return <IconGeneric size={iconSize} />;
  }
};

//used for project creation and onboarding
//determines what integration maps to what project platform
export const platfromToIntegrationMap = {
  'node-awslambda': 'aws_lambda',
};
