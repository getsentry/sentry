import {IntegrationType, SentryAppStatus} from 'sentry/types';

import {platformEventMap, PlatformEventParameters} from './platformAnalyticsEvents';

export type IntegrationView = {
  view?:
    | 'external_install'
    | 'legacy_integrations'
    | 'plugin_details'
    | 'integrations_directory'
    | 'integrations_directory_integration_detail'
    | 'stacktrace_link'
    | 'stacktrace_issue_details'
    | 'integration_configuration_detail'
    | 'onboarding'
    | 'project_creation'
    | 'developer_settings'
    | 'new_integration_modal';
};

type SingleIntegrationEventParams = {
  integration: string; // the slug
  integration_type: IntegrationType;
  already_installed?: boolean;
  // include the status since people might do weird things testing unpublished integrations
  integration_status?: SentryAppStatus;
  integration_tab?: 'configurations' | 'overview' | 'features';
  plan?: string;
} & IntegrationView;

type MultipleIntegrationsEventParams = {
  integrations_installed: number;
} & IntegrationView;

type IntegrationSearchEventParams = {
  num_results: number;
  search_term: string;
} & IntegrationView;

type IntegrationCategorySelectEventParams = {
  category: string;
} & IntegrationView;

type IntegrationServerlessFunctionsViewedParams = {
  num_functions: number;
} & SingleIntegrationEventParams;

type IntegrationServerlessFunctionActionParams = {
  action: 'enable' | 'disable' | 'updateVersion';
} & SingleIntegrationEventParams;

type IntegrationInstallationInputValueChangeEventParams = {
  field_name: string;
} & SingleIntegrationEventParams;

type ProjectOwnershipModalParams = {
  page: 'issue_details' | 'project_settings';
  net_change?: number;
};

// Event key to payload mappings
export type IntegrationEventParameters = {
  'integrations.cloudformation_link_clicked': SingleIntegrationEventParams;
  'integrations.config_saved': SingleIntegrationEventParams;
  'integrations.details_viewed': SingleIntegrationEventParams;
  'integrations.directory_category_selected': IntegrationCategorySelectEventParams;
  'integrations.directory_item_searched': IntegrationSearchEventParams;
  'integrations.disabled': SingleIntegrationEventParams;
  'integrations.enabled': SingleIntegrationEventParams;
  'integrations.index_viewed': MultipleIntegrationsEventParams;
  'integrations.install_modal_opened': SingleIntegrationEventParams;
  'integrations.installation_complete': SingleIntegrationEventParams;
  'integrations.installation_input_value_changed': IntegrationInstallationInputValueChangeEventParams;
  'integrations.installation_start': SingleIntegrationEventParams;
  'integrations.integration_tab_clicked': SingleIntegrationEventParams;
  'integrations.integration_viewed': SingleIntegrationEventParams;
  'integrations.plugin_add_to_project_clicked': SingleIntegrationEventParams;
  'integrations.request_install': SingleIntegrationEventParams;
  'integrations.resolve_now_clicked': SingleIntegrationEventParams;
  'integrations.serverless_function_action': IntegrationServerlessFunctionActionParams;
  'integrations.serverless_functions_viewed': IntegrationServerlessFunctionsViewedParams;
  'integrations.switch_manual_sdk_setup': SingleIntegrationEventParams;
  'integrations.uninstall_clicked': SingleIntegrationEventParams;
  'integrations.uninstall_completed': SingleIntegrationEventParams;
  'integrations.upgrade_plan_modal_opened': SingleIntegrationEventParams;
  'project_ownership.modal_opened': ProjectOwnershipModalParams;
  'project_ownership.saved': ProjectOwnershipModalParams;
} & PlatformEventParameters;

export type IntegrationAnalyticsKey = keyof IntegrationEventParameters;

// Event key to name mappings
export const integrationEventMap: Record<IntegrationAnalyticsKey, string> = {
  'integrations.upgrade_plan_modal_opened': 'Integrations: Upgrade Plan Modal Opened',
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
  'integrations.details_viewed': 'Integrations: Details Viewed',
  'integrations.index_viewed': 'Integrations: Index Page Viewed',
  'integrations.directory_item_searched': 'Integrations: Directory Item Searched',
  'integrations.directory_category_selected': 'Integrations: Directory Category Selected',
  'integrations.serverless_functions_viewed': 'Integrations: Serverless Functions Viewed',
  'integrations.installation_input_value_changed':
    'Integrations: Installation Input Value Changed',
  'integrations.serverless_function_action': 'Integrations: Serverless Function Action',
  'integrations.cloudformation_link_clicked': 'Integrations: CloudFormation Link Clicked',
  'integrations.switch_manual_sdk_setup': 'Integrations: Switch Manual SDK Setup',
  'project_ownership.modal_opened': 'Project Ownership: Modal Opened',
  'project_ownership.saved': 'Project Ownership: Saved',
  ...platformEventMap,
};
