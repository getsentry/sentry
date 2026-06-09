export type ProjectCreationEventParameters = {
  'project_creation.back_button_clicked': Record<string, unknown>;
  'project_creation.data_removal_modal_confirm_button_clicked': {
    platform: string;
    project_id: string;
  };
  'project_creation.data_removal_modal_dismissed': {platform: string; project_id: string};
  'project_creation.data_removal_modal_rendered': {platform: string; project_id: string};
  'project_creation.data_removed': {
    date_created: string;
    platform: string;
    project_id: string;
  };
  // SCM-first project creation flow (mirrors onboarding.scm_*)
  'project_creation.scm_connect_repo_selected': {
    provider: string;
    repo: string;
  };
  'project_creation.scm_connect_step_viewed': Record<string, unknown>;
  'project_creation.scm_platform_change_platform_clicked': Record<string, unknown>;
  'project_creation.scm_platform_feature_toggled': {
    enabled: boolean;
    feature: string;
    platform: string;
  };
  'project_creation.scm_platform_features_step_viewed': Record<string, unknown>;
  'project_creation.scm_platform_selected': {
    platform: string;
    source: 'detected' | 'manual';
  };
  'project_creation.scm_project_details_alert_selected': {
    option: string;
  };
  'project_creation.scm_project_details_create_clicked': Record<string, unknown>;
  'project_creation.scm_project_details_create_failed': Record<string, unknown>;
  'project_creation.scm_project_details_create_succeeded': {
    project_slug: string;
  };
  'project_creation.scm_project_details_name_edited': {
    custom: boolean;
  };
  'project_creation.scm_project_details_step_viewed': Record<string, unknown>;
  'project_creation.scm_project_details_team_selected': {
    team: string;
  };
  'project_creation.scm_skip_detection_clicked': Record<string, unknown>;
  'project_creation.select_framework_modal_close_button_clicked': {
    platform: string;
  };
  'project_creation.select_framework_modal_configure_sdk_button_clicked': {
    framework: string;
    platform: string;
  };
  'project_creation.select_framework_modal_rendered': {
    platform: string;
  };
  'project_creation.select_framework_modal_skip_button_clicked': {
    platform: string;
  };
  'project_creation.source_maps_wizard_button_copy_clicked': {
    platform: string;
    project_id: string;
  };
  'project_creation.source_maps_wizard_selected_and_copied': {
    platform: string;
    project_id: string;
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
  'project_creation.scm_connect_repo_selected':
    'Project Creation: SCM Connect Repo Selected',
  'project_creation.scm_connect_step_viewed': 'Project Creation: SCM Connect Step Viewed',
  'project_creation.scm_platform_change_platform_clicked':
    'Project Creation: SCM Platform Change Platform Clicked',
  'project_creation.scm_platform_feature_toggled':
    'Project Creation: SCM Platform Feature Toggled',
  'project_creation.scm_platform_features_step_viewed':
    'Project Creation: SCM Platform Features Step Viewed',
  'project_creation.scm_platform_selected': 'Project Creation: SCM Platform Selected',
  'project_creation.scm_project_details_alert_selected':
    'Project Creation: SCM Project Details Alert Selected',
  'project_creation.scm_project_details_create_clicked':
    'Project Creation: SCM Project Details Create Clicked',
  'project_creation.scm_project_details_create_failed':
    'Project Creation: SCM Project Details Create Failed',
  'project_creation.scm_project_details_create_succeeded':
    'Project Creation: SCM Project Details Create Succeeded',
  'project_creation.scm_project_details_name_edited':
    'Project Creation: SCM Project Details Name Edited',
  'project_creation.scm_project_details_step_viewed':
    'Project Creation: SCM Project Details Step Viewed',
  'project_creation.scm_project_details_team_selected':
    'Project Creation: SCM Project Details Team Selected',
  'project_creation.scm_skip_detection_clicked':
    'Project Creation: SCM Skip Detection Clicked',
  'project_creation.source_maps_wizard_button_copy_clicked':
    'Project Creation: Source Maps Wizard Button Copy Clicked',
  'project_creation.source_maps_wizard_selected_and_copied':
    'Project Creation: Source Maps Wizard Selected and Copied',
};
