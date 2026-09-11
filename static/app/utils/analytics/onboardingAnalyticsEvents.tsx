import type {ScmMessagingProviderKey} from 'sentry/components/onboarding/scm/messagingProviders';

/**
 * Where the created project's issue alerts go: the server-created email rule
 * only, or that plus a messaging integration workflow.
 */
type ScmMessagingNotification = 'email_only' | 'integration';

/**
 * The only identifier the messaging-step interaction events carry. Workspace,
 * integration, channel, team, and project identifiers or names are never sent.
 */
type ScmMessagingProviderParams = {
  provider: ScmMessagingProviderKey;
};

export type OnboardingEventParameters = {
  'onboarding.ai_prompt_copied': {
    platform: string;
    product: 'logs' | 'traces' | 'conversations' | 'agents';
    source: 'install_command' | 'prompt';
  };
  'onboarding.back_button_clicked': {
    browserBackButton: boolean;
    from: string;
    to: string;
  };
  'onboarding.data_removal_modal_confirm_button_clicked': {
    platform: string;
    project_id: string;
  };
  'onboarding.data_removal_modal_dismissed': {
    platform: string;
    project_id: string;
  };
  'onboarding.data_removal_modal_rendered': {
    platform: string;
    project_id: string;
  };
  'onboarding.data_removed': {
    date_created: string;
    platform: string;
    project_id: string;
  };
  'onboarding.dsn-copied': {
    platform: string;
  };
  'onboarding.js_loader_npm_docs_shown': {
    platform: string;
    project_id: string;
  };
  'onboarding.js_loader_optional_configuration_shown': {
    platform: string;
    project_id: string;
  };
  'onboarding.next_step_clicked': {
    newOrg: boolean;
    platform: string;
    products: string[];
    project_id: string;
    step: string;
  };
  'onboarding.scm_back_button_clicked': {
    browserBackButton: boolean;
    from: string;
    to: string;
  };
  'onboarding.scm_connect_integration_selected': {
    provider: string;
    // 'default' when the integration was auto-selected on entry, 'manual' when
    // the user explicitly switched via the selector.
    source: 'default' | 'manual';
  };
  'onboarding.scm_connect_repo_selected': {
    provider: string;
    repo: string;
  };
  'onboarding.scm_connect_step_viewed': Record<string, unknown>;
  'onboarding.scm_data_removal_modal_confirm_button_clicked': {
    platform: string;
    project_id: string;
  };
  'onboarding.scm_data_removed': {
    date_created: string;
    platform: string;
    project_id: string;
  };
  'onboarding.scm_dsn_copied': {
    platform: string;
  };
  'onboarding.scm_header_skip_clicked': {
    step: string;
  };
  'onboarding.scm_js_loader_npm_docs_shown': {
    platform: string;
    project_id: string;
  };
  'onboarding.scm_messaging_channel_validation_failed': ScmMessagingProviderParams;
  'onboarding.scm_messaging_choose_destination_cancelled': ScmMessagingProviderParams;
  'onboarding.scm_messaging_choose_destination_clicked': ScmMessagingProviderParams;
  'onboarding.scm_messaging_completed': {
    notification: ScmMessagingNotification;
  };
  'onboarding.scm_messaging_connect_clicked': ScmMessagingProviderParams;
  'onboarding.scm_messaging_destination_edit_cancelled': ScmMessagingProviderParams;
  'onboarding.scm_messaging_destination_edit_clicked': ScmMessagingProviderParams;
  'onboarding.scm_messaging_destination_remove_cancelled': ScmMessagingProviderParams;
  'onboarding.scm_messaging_destination_remove_confirmed': ScmMessagingProviderParams;
  'onboarding.scm_messaging_install_retry_clicked': ScmMessagingProviderParams;
  'onboarding.scm_messaging_install_returned': ScmMessagingProviderParams & {
    // Whether the refetch after the install flow returned surfaced an active
    // integration that can receive issue alerts.
    outcome: 'connected' | 'not_connected';
  };
  'onboarding.scm_messaging_msteams_handoff_started': ScmMessagingProviderParams;
  'onboarding.scm_messaging_providers_retry_clicked': Record<string, unknown>;
  'onboarding.scm_messaging_step_viewed': Record<string, unknown>;
  'onboarding.scm_next_step_clicked': {
    newOrg: boolean;
    platform: string;
    products: string[];
    project_id: string;
    step: string;
  };
  'onboarding.scm_platform_change_platform_clicked': Record<string, unknown>;
  'onboarding.scm_platform_feature_toggled': {
    enabled: boolean;
    feature: string;
    platform: string;
  };
  'onboarding.scm_platform_features_step_viewed': Record<string, unknown>;
  'onboarding.scm_platform_selected': {
    platform: string;
    source: 'detected' | 'manual';
  };
  'onboarding.scm_project_created': {
    notification: ScmMessagingNotification;
    platform: string;
    project_id: string;
  };
  'onboarding.scm_select_framework_modal_rendered': {
    platform: string;
  };
  'onboarding.scm_setup_loader_docs_rendered': {
    platform: string;
    project_id: string;
  };
  'onboarding.scm_setup_platform_later_clicked': {
    platform: string;
    project_id: string;
  };
  'onboarding.scm_skip_detection_clicked': Record<string, unknown>;
  'onboarding.scm_source_maps_wizard_button_copy_clicked': {
    platform: string;
    project_id: string;
  };
  'onboarding.scm_source_maps_wizard_selected_and_copied': {
    platform: string;
    project_id: string;
  };
  'onboarding.scm_take_to_error_clicked': {
    platform?: string;
  };
  'onboarding.scm_view_sample_event_clicked': {
    platform?: string;
  };
  'onboarding.scm_welcome_agent_command_copied': {
    source: 'install_command' | 'prompt';
  };
  'onboarding.scm_welcome_continue_clicked': Record<string, unknown>;
  'onboarding.scm_welcome_present_agentic_interstitial_clicked': Record<string, unknown>;
  'onboarding.scm_welcome_step_viewed': Record<string, unknown>;
  'onboarding.select_framework_modal_close_button_clicked': {
    platform: string;
  };
  'onboarding.select_framework_modal_configure_sdk_button_clicked': {
    framework: string;
    platform: string;
  };
  'onboarding.select_framework_modal_rendered': {
    platform: string;
  };
  'onboarding.select_framework_modal_skip_button_clicked': {
    platform: string;
  };
  'onboarding.setup_loader_docs_rendered': {
    platform: string;
    project_id: string;
  };
  'onboarding.slack_setup_clicked': {
    project_id: string;
  };
  'onboarding.source_maps_wizard_button_copy_clicked': {
    platform: string;
    project_id: string;
  };
  'onboarding.source_maps_wizard_selected_and_copied': {
    platform: string;
    project_id: string;
  };
  'onboarding.take_me_to_issues_clicked': {
    platform: string;
    products: string[];
    project_id: string;
  };
};

export const onboardingEventMap: Record<keyof OnboardingEventParameters, string> = {
  'onboarding.ai_prompt_copied': 'Onboarding: AI Prompt Copied',
  'onboarding.js_loader_optional_configuration_shown':
    'Onboarding: JS Loader Optional Configuration Expanded',
  'onboarding.js_loader_npm_docs_shown':
    'Onboarding: JS Loader Switch to npm Instructions',
  'onboarding.setup_loader_docs_rendered': 'Onboarding: Setup Loader Docs Rendered',
  'onboarding.back_button_clicked': 'Onboarding: Back Button Clicked',
  'onboarding.select_framework_modal_close_button_clicked':
    'Onboarding: Framework Modal Close Button Clicked',
  'onboarding.select_framework_modal_configure_sdk_button_clicked':
    'Onboarding: Framework Modal Configure SDK Button Clicked',
  'onboarding.select_framework_modal_rendered': 'Onboarding: Framework Modal Rendered',
  'onboarding.select_framework_modal_skip_button_clicked':
    'Onboarding: Framework Modal Skip Button Clicked',
  'onboarding.data_removal_modal_dismissed': 'Onboarding: Data Removal Modal Dismissed',
  'onboarding.data_removal_modal_confirm_button_clicked':
    'Onboarding: Data Removal Modal Confirm Button Clicked',
  'onboarding.data_removal_modal_rendered': 'Onboarding: Data Removal Modal Rendered',
  'onboarding.data_removed': 'Onboarding: Data Removed',
  'onboarding.source_maps_wizard_button_copy_clicked':
    'Onboarding: Source Maps Wizard Copy Button Clicked',
  'onboarding.source_maps_wizard_selected_and_copied':
    'Onboarding: Source Maps Wizard Selected and Copied',
  'onboarding.dsn-copied': 'Onboarding: DSN Copied',
  'onboarding.take_me_to_issues_clicked': 'Onboarding: Take Me to Issues Clicked',
  'onboarding.slack_setup_clicked': 'Onboarding: Slack Setup Clicked',
  'onboarding.next_step_clicked': 'Onboarding: Next Step Clicked',
  'onboarding.scm_back_button_clicked': 'Onboarding: SCM Back Button Clicked',
  'onboarding.scm_connect_integration_selected':
    'Onboarding: SCM Connect Integration Selected',
  'onboarding.scm_connect_repo_selected': 'Onboarding: SCM Connect Repo Selected',
  'onboarding.scm_connect_step_viewed': 'Onboarding: SCM Connect Step Viewed',
  'onboarding.scm_data_removal_modal_confirm_button_clicked':
    'Onboarding: SCM Data Removal Modal Confirm Button Clicked',
  'onboarding.scm_data_removed': 'Onboarding: SCM Data Removed',
  'onboarding.scm_dsn_copied': 'Onboarding: SCM DSN Copied',
  'onboarding.scm_js_loader_npm_docs_shown':
    'Onboarding: SCM JS Loader Switch to npm Instructions',
  'onboarding.scm_messaging_channel_validation_failed':
    'Onboarding: SCM Messaging Channel Validation Failed',
  'onboarding.scm_messaging_choose_destination_cancelled':
    'Onboarding: SCM Messaging Choose Destination Cancelled',
  'onboarding.scm_messaging_choose_destination_clicked':
    'Onboarding: SCM Messaging Choose Destination Clicked',
  'onboarding.scm_messaging_completed': 'Onboarding: SCM Messaging Completed',
  'onboarding.scm_messaging_connect_clicked': 'Onboarding: SCM Messaging Connect Clicked',
  'onboarding.scm_messaging_destination_edit_cancelled':
    'Onboarding: SCM Messaging Destination Edit Cancelled',
  'onboarding.scm_messaging_destination_edit_clicked':
    'Onboarding: SCM Messaging Destination Edit Clicked',
  'onboarding.scm_messaging_destination_remove_cancelled':
    'Onboarding: SCM Messaging Destination Remove Cancelled',
  'onboarding.scm_messaging_destination_remove_confirmed':
    'Onboarding: SCM Messaging Destination Remove Confirmed',
  'onboarding.scm_messaging_install_retry_clicked':
    'Onboarding: SCM Messaging Install Retry Clicked',
  'onboarding.scm_messaging_install_returned':
    'Onboarding: SCM Messaging Install Returned',
  'onboarding.scm_messaging_msteams_handoff_started':
    'Onboarding: SCM Messaging MS Teams Handoff Started',
  'onboarding.scm_messaging_providers_retry_clicked':
    'Onboarding: SCM Messaging Providers Retry Clicked',
  'onboarding.scm_messaging_step_viewed': 'Onboarding: SCM Messaging Step Viewed',
  'onboarding.scm_next_step_clicked': 'Onboarding: SCM Next Step Clicked',
  'onboarding.scm_select_framework_modal_rendered':
    'Onboarding: SCM Framework Modal Rendered',
  'onboarding.scm_setup_loader_docs_rendered':
    'Onboarding: SCM Setup Loader Docs Rendered',
  'onboarding.scm_source_maps_wizard_button_copy_clicked':
    'Onboarding: SCM Source Maps Wizard Copy Button Clicked',
  'onboarding.scm_source_maps_wizard_selected_and_copied':
    'Onboarding: SCM Source Maps Wizard Selected and Copied',
  'onboarding.scm_header_skip_clicked': 'Onboarding: SCM Header Skip Clicked',
  'onboarding.scm_platform_change_platform_clicked':
    'Onboarding: SCM Platform Change Platform Clicked',
  'onboarding.scm_platform_feature_toggled': 'Onboarding: SCM Platform Feature Toggled',
  'onboarding.scm_platform_features_step_viewed':
    'Onboarding: SCM Platform Features Step Viewed',
  'onboarding.scm_platform_selected': 'Onboarding: SCM Platform Selected',
  'onboarding.scm_project_created': 'Onboarding: SCM Project Created',
  'onboarding.scm_skip_detection_clicked': 'Onboarding: SCM Skip Detection Clicked',
  'onboarding.scm_setup_platform_later_clicked':
    'Onboarding: SCM Setup Platform Later Clicked',
  'onboarding.scm_take_to_error_clicked': 'Onboarding: SCM Take to Error Clicked',
  'onboarding.scm_view_sample_event_clicked': 'Onboarding: SCM View Sample Event Clicked',
  'onboarding.scm_welcome_agent_command_copied':
    'Onboarding: SCM Welcome Agent Command Copied',
  'onboarding.scm_welcome_continue_clicked': 'Onboarding: SCM Welcome Continue Clicked',
  'onboarding.scm_welcome_present_agentic_interstitial_clicked':
    'Onboarding: SCM Welcome Present Agentic Interstitial Clicked',
  'onboarding.scm_welcome_step_viewed': 'Onboarding: SCM Welcome Step Viewed',
};
