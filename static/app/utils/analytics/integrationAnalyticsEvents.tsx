import {StacktraceErrorMessage} from 'sentry/components/events/interfaces/frame/stacktraceLink';
import {IntegrationType, PlatformType, SentryAppStatus} from 'sentry/types';

// define the various event payloads
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
  integration: string; // the slug
  integration_type: IntegrationType;
  already_installed?: boolean;
  // include the status since people might do weird things testing unpublished integrations
  integration_status?: SentryAppStatus;
  integration_tab?: 'configurations' | 'overview';
  plan?: string;
} & View;

type MultipleIntegrationsEventParams = {
  integrations_installed: number;
} & View;

type IntegrationSearchEventParams = {
  num_results: number;
  search_term: string;
} & View;

type IntegrationCategorySelectEventParams = {
  category: string;
} & View;

type IntegrationStacktraceLinkEventParams = {
  error_reason?: StacktraceErrorMessage;
  platform?: PlatformType;
  provider?: string;
  setup_type?: 'automatic' | 'manual';
} & View;

type IntegrationServerlessFunctionsViewedParams = {
  num_functions: number;
} & SingleIntegrationEventParams;

type IntegrationServerlessFunctionActionParams = {
  action: 'enable' | 'disable' | 'updateVersion';
} & SingleIntegrationEventParams;

type IntegrationInstallationInputValueChangeEventParams = {
  field_name: string;
} & SingleIntegrationEventParams;

type IntegrationCodeOwnersEventParams = {
  project_id: string;
} & View;
// define the event key to payload mappings
export type IntegrationEventParameters = {
  'integrations.cloudformation_link_clicked': SingleIntegrationEventParams;
  'integrations.code_mappings_viewed': SingleIntegrationEventParams;
  'integrations.code_owners_cta_docs_clicked': IntegrationCodeOwnersEventParams;
  'integrations.code_owners_cta_setup_clicked': IntegrationCodeOwnersEventParams;
  'integrations.config_saved': SingleIntegrationEventParams;
  'integrations.details_viewed': SingleIntegrationEventParams;
  'integrations.directory_category_selected': IntegrationCategorySelectEventParams;
  'integrations.directory_item_searched': IntegrationSearchEventParams;
  'integrations.disabled': SingleIntegrationEventParams;
  'integrations.dismissed_code_owners_prompt': IntegrationCodeOwnersEventParams;
  'integrations.enabled': SingleIntegrationEventParams;
  // for an individual configuration
  'integrations.index_viewed': MultipleIntegrationsEventParams;
  'integrations.install_modal_opened': SingleIntegrationEventParams;
  'integrations.installation_complete': SingleIntegrationEventParams;
  'integrations.installation_input_value_changed': IntegrationInstallationInputValueChangeEventParams;
  'integrations.installation_start': SingleIntegrationEventParams;
  'integrations.integration_tab_clicked': SingleIntegrationEventParams;
  'integrations.integration_viewed': SingleIntegrationEventParams;
  'integrations.plugin_add_to_project_clicked': SingleIntegrationEventParams;
  'integrations.reconfigure_stacktrace_setup': IntegrationStacktraceLinkEventParams;
  'integrations.request_install': SingleIntegrationEventParams;
  'integrations.resolve_now_clicked': SingleIntegrationEventParams;
  'integrations.serverless_function_action': IntegrationServerlessFunctionActionParams;
  'integrations.serverless_functions_viewed': IntegrationServerlessFunctionsViewedParams;
  'integrations.show_code_owners_prompt': IntegrationCodeOwnersEventParams;
  'integrations.stacktrace_complete_setup': IntegrationStacktraceLinkEventParams;
  'integrations.stacktrace_docs_clicked': IntegrationStacktraceLinkEventParams;
  'integrations.stacktrace_link_clicked': IntegrationStacktraceLinkEventParams;
  'integrations.stacktrace_link_cta_dismissed': IntegrationStacktraceLinkEventParams;
  'integrations.stacktrace_manual_option_clicked': IntegrationStacktraceLinkEventParams;
  'integrations.stacktrace_start_setup': IntegrationStacktraceLinkEventParams;
  'integrations.stacktrace_submit_config': IntegrationStacktraceLinkEventParams;
  'integrations.switch_manual_sdk_setup': SingleIntegrationEventParams;
  'integrations.uninstall_clicked': SingleIntegrationEventParams;
  'integrations.uninstall_completed': SingleIntegrationEventParams;
  'integrations.upgrade_plan_modal_opened': SingleIntegrationEventParams;
};

export type IntegrationAnalyticsKey = keyof IntegrationEventParameters;

// define the event key to event name mappings
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
  'integrations.code_owners_cta_setup_clicked':
    'Integrations: Code Owners CTA Setup Clicked',
  'integrations.code_owners_cta_docs_clicked':
    'Integrations: Code Owners CTA Setup Clicked',
  'integrations.show_code_owners_prompt': 'Integrations: Show Code Owners Prompt',
  'integrations.dismissed_code_owners_prompt':
    'Integrations: Dismissed Code Owners Prompt',
};
