import {IntegrationType, PlatformType, SentryAppStatus} from 'app/types';

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
export type IntegrationEventParameters = {
  'integrations.upgrade_plan_modal_opened': SingleIntegrationEventParams;
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
  'integrations.stacktrace_link_cta_dismissed': IntegrationStacktraceLinkEventParams;
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

export type IntegrationAnalyticsKey = keyof IntegrationEventParameters;

//define the event key to event name mappings
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
  'integrations.code_mappings_viewed': 'Integrations: Code Mappings Viewed',
  'integrations.details_viewed': 'Integrations: Details Viewed',
  'integrations.index_viewed': 'Integrations: Index Page Viewed',
  'integrations.directory_item_searched': 'Integrations: Directory Item Searched',
  'integrations.directory_category_selected': 'Integrations: Directory Category Selected',
  'integrations.stacktrace_link_cta_dismissed':
    'Integrations: Stacktrace Link CTA Dismissed',
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
