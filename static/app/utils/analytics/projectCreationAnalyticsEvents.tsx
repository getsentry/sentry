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
  'project_creation.source_maps_wizard_button_copy_clicked':
    'Project Creation: Source Maps Wizard Button Copy Clicked',
  'project_creation.source_maps_wizard_selected_and_copied':
    'Project Creation: Source Maps Wizard Selected and Copied',
};
