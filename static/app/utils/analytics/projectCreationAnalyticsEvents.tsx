export type ProjectCreationEventParameters = {
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
};
