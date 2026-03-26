export type OnboardingEventParameters = {
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
  'onboarding.scm_connect_repo_selected': {
    provider: string;
    repo: string;
  };
  'onboarding.scm_connect_step_viewed': Record<string, unknown>;
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
  'onboarding.scm_project_details_alert_selected': {
    option: string;
  };
  'onboarding.scm_project_details_create_clicked': Record<string, unknown>;
  'onboarding.scm_project_details_create_failed': Record<string, unknown>;
  'onboarding.scm_project_details_create_succeeded': {
    project_slug: string;
  };
  'onboarding.scm_project_details_name_edited': {
    custom: boolean;
  };
  'onboarding.scm_project_details_step_viewed': Record<string, unknown>;
  'onboarding.scm_project_details_team_selected': {
    team: string;
  };
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
  'onboarding.scm_connect_repo_selected': 'Onboarding: SCM Connect Repo Selected',
  'onboarding.scm_connect_step_viewed': 'Onboarding: SCM Connect Step Viewed',
  'onboarding.scm_platform_change_platform_clicked':
    'Onboarding: SCM Platform Change Platform Clicked',
  'onboarding.scm_platform_feature_toggled': 'Onboarding: SCM Platform Feature Toggled',
  'onboarding.scm_platform_features_step_viewed':
    'Onboarding: SCM Platform Features Step Viewed',
  'onboarding.scm_platform_selected': 'Onboarding: SCM Platform Selected',
  'onboarding.scm_project_details_alert_selected':
    'Onboarding: SCM Project Details Alert Selected',
  'onboarding.scm_project_details_create_clicked':
    'Onboarding: SCM Project Details Create Clicked',
  'onboarding.scm_project_details_create_failed':
    'Onboarding: SCM Project Details Create Failed',
  'onboarding.scm_project_details_create_succeeded':
    'Onboarding: SCM Project Details Create Succeeded',
  'onboarding.scm_project_details_name_edited':
    'Onboarding: SCM Project Details Name Edited',
  'onboarding.scm_project_details_step_viewed':
    'Onboarding: SCM Project Details Step Viewed',
  'onboarding.scm_project_details_team_selected':
    'Onboarding: SCM Project Details Team Selected',
};
