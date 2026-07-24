/**
 * Project-creation-flow variant. Encodes SCM vs legacy in a param instead of the
 * event name so both variants keep incrementing the same `project_creation.*`
 * counter (preserving absolute dashboard totals) while staying segmentable. See
 * the setup-docs events below and the SCM cores that emit it.
 */
export type ProjectCreationVariant = 'scm' | 'legacy';

export type ProjectCreationEventParameters = {
  'project_creation.alert_threshold_edited': {
    field: 'threshold' | 'metric' | 'interval';
    variant?: ProjectCreationVariant;
  };
  'project_creation.back_button_clicked': {
    variant?: ProjectCreationVariant;
  };
  // SCM-first project creation wizard steps. SCM vs legacy rides in `variant`
  // (see scmFlowVariantParams); these events are only emitted by the SCM cores
  // today, so `variant` is `scm` in practice, but stays optional so a future
  // legacy sibling can share the name.
  'project_creation.connect_integration_selected': {
    provider: string;
    // 'default' when the integration was auto-selected on entry, 'manual' when
    // the user explicitly switched via the selector.
    source: 'default' | 'manual';
    variant?: ProjectCreationVariant;
  };
  'project_creation.connect_repo_selected': {
    provider: string;
    repo: string;
    variant?: ProjectCreationVariant;
  };
  'project_creation.data_removal_modal_confirm_button_clicked': {
    platform: string;
    project_id: string;
    variant?: ProjectCreationVariant;
  };
  // Defined but never fired — back-nav deletes directly with no modal. Left in
  // the registry so historical dashboards don't lose the key; do not wire.
  'project_creation.data_removal_modal_dismissed': {platform: string; project_id: string};
  'project_creation.data_removal_modal_rendered': {platform: string; project_id: string};
  'project_creation.data_removed': {
    date_created: string;
    platform: string;
    project_id: string;
    variant?: ProjectCreationVariant;
  };
  // Setup-docs (getting-started) page events, mirroring onboarding.* /
  // onboarding.scm_*. The non-scm_ keys fix a pollution bug where project
  // creation previously emitted onboarding.* for these interactions. The
  // optional `variant` splits SCM vs legacy project creation without a separate
  // event name (see docsFlowAnalytics.ts / docsFlowVariantParams).
  'project_creation.dsn_copied': {
    platform: string;
    variant?: ProjectCreationVariant;
  };
  'project_creation.js_loader_npm_docs_shown': {
    platform: string;
    project_id: string;
    variant?: ProjectCreationVariant;
  };
  'project_creation.manage_providers_clicked': {
    variant?: ProjectCreationVariant;
  };
  'project_creation.next_step_clicked': {
    newOrg: boolean;
    platform: string;
    products: string[];
    project_id: string;
    step: string;
    variant?: ProjectCreationVariant;
  };
  'project_creation.notify_channel_changed': {
    variant?: ProjectCreationVariant;
  };
  'project_creation.notify_integration_changed': {
    variant?: ProjectCreationVariant;
  };
  'project_creation.notify_integration_toggled': {
    enabled: boolean;
    variant?: ProjectCreationVariant;
  };
  'project_creation.notify_provider_changed': {
    provider: string;
    variant?: ProjectCreationVariant;
  };
  'project_creation.platform_change_platform_clicked': {
    variant?: ProjectCreationVariant;
  };
  'project_creation.platform_feature_toggled': {
    enabled: boolean;
    feature: string;
    platform: string;
    variant?: ProjectCreationVariant;
  };
  'project_creation.project_details_alert_selected': {
    option: string;
    variant?: ProjectCreationVariant;
  };
  'project_creation.project_details_create_clicked': {
    variant?: ProjectCreationVariant;
  };
  'project_creation.project_details_create_failed': {
    variant?: ProjectCreationVariant;
  };
  'project_creation.project_details_name_edited': {
    custom: boolean;
    variant?: ProjectCreationVariant;
  };
  'project_creation.project_details_team_selected': {
    team: string;
    variant?: ProjectCreationVariant;
  };
  'project_creation.select_framework_modal_close_button_clicked': {
    platform: string;
  };
  'project_creation.select_framework_modal_configure_sdk_button_clicked': {
    framework: string;
    platform: string;
  };
  'project_creation.select_framework_modal_rendered': {
    platform: string;
    variant?: ProjectCreationVariant;
  };
  'project_creation.select_framework_modal_skip_button_clicked': {
    platform: string;
  };
  'project_creation.setup_loader_docs_rendered': {
    platform: string;
    project_id: string;
    variant?: ProjectCreationVariant;
  };
  'project_creation.skip_detection_clicked': {
    variant?: ProjectCreationVariant;
  };
  'project_creation.source_maps_wizard_button_copy_clicked': {
    platform: string;
    project_id: string;
    variant?: ProjectCreationVariant;
  };
  'project_creation.source_maps_wizard_selected_and_copied': {
    platform: string;
    project_id: string;
    variant?: ProjectCreationVariant;
  };
  'project_creation.take_me_to_issues_clicked': {
    platform: string;
    products: string[];
    project_id: string;
    variant: ProjectCreationVariant;
  };
};

export const projectCreationEventMap: Record<
  keyof ProjectCreationEventParameters,
  string
> = {
  'project_creation.select_framework_modal_close_button_clicked':
    'Project Creation: Framework Modal Close Button Clicked',
  'project_creation.select_framework_modal_configure_sdk_button_clicked':
    'Project Creation: Framework Modal Configure SDK Button Clicked',
  'project_creation.select_framework_modal_rendered':
    'Project Creation: Framework Modal Rendered',
  'project_creation.select_framework_modal_skip_button_clicked':
    'Project Creation: Framework Modal Skip Button Clicked',
  'project_creation.data_removal_modal_dismissed':
    'Project Creation: Data Removal Modal Dismissed',
  'project_creation.data_removal_modal_confirm_button_clicked':
    'Project Creation: Data Removal Modal Confirm Button Clicked',
  'project_creation.data_removal_modal_rendered':
    'Project Creation: Data Removal Modal Rendered',
  'project_creation.data_removed': 'Project Creation: Data Removed',
  'project_creation.back_button_clicked': 'Project Creation: Back Button Clicked',
  'project_creation.alert_threshold_edited': 'Project Creation: Alert Threshold Edited',
  'project_creation.notify_integration_toggled':
    'Project Creation: Notify Integration Toggled',
  'project_creation.notify_provider_changed': 'Project Creation: Notify Provider Changed',
  'project_creation.notify_integration_changed':
    'Project Creation: Notify Integration Changed',
  'project_creation.notify_channel_changed': 'Project Creation: Notify Channel Changed',
  'project_creation.connect_integration_selected':
    'Project Creation: Connect Integration Selected',
  'project_creation.connect_repo_selected': 'Project Creation: Connect Repo Selected',
  'project_creation.platform_change_platform_clicked':
    'Project Creation: Platform Change Platform Clicked',
  'project_creation.platform_feature_toggled':
    'Project Creation: Platform Feature Toggled',
  'project_creation.project_details_alert_selected':
    'Project Creation: Project Details Alert Selected',
  'project_creation.project_details_create_clicked':
    'Project Creation: Project Details Create Clicked',
  'project_creation.project_details_create_failed':
    'Project Creation: Project Details Create Failed',
  'project_creation.project_details_name_edited':
    'Project Creation: Project Details Name Edited',
  'project_creation.project_details_team_selected':
    'Project Creation: Project Details Team Selected',
  'project_creation.skip_detection_clicked': 'Project Creation: Skip Detection Clicked',
  'project_creation.source_maps_wizard_button_copy_clicked':
    'Project Creation: Source Maps Wizard Button Copy Clicked',
  'project_creation.source_maps_wizard_selected_and_copied':
    'Project Creation: Source Maps Wizard Selected and Copied',
  'project_creation.dsn_copied': 'Project Creation: DSN Copied',
  'project_creation.next_step_clicked': 'Project Creation: Next Step Clicked',
  'project_creation.manage_providers_clicked':
    'Project Creation: Manage Providers Clicked',
  'project_creation.js_loader_npm_docs_shown':
    'Project Creation: JS Loader Switch to npm Instructions',
  'project_creation.setup_loader_docs_rendered':
    'Project Creation: Setup Loader Docs Rendered',
  'project_creation.take_me_to_issues_clicked':
    'Project Creation: Take Me to Issues Clicked',
};
