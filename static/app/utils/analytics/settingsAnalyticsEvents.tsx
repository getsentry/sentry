/**
 * Links outside of the settings navigation that take people into settings.
 * - `settings_navigation.org_menu`: "Settings" item in the organization avatar menu
 * - `settings_navigation.user_menu`: "Settings" item in the user avatar menu
 * - `project_page_filter`: settings icon on a project in the project page filter
 * - `project_details_menu`: "Project Settings" item on the project details page
 * - `project_card`: settings icon on a project card in the projects list
 */
export type SettingsLinkSource =
  | 'settings_navigation.org_menu'
  | 'settings_navigation.user_menu'
  | 'project_page_filter'
  | 'project_details_menu'
  | 'project_card';

/**
 * Where a project was picked from in the organization avatar menu.
 * - `quick_access`: the "Project Settings" section
 * - `all_projects`: the "View All Projects" submenu
 */
type SettingsOrgMenuProjectSource = 'quick_access' | 'all_projects';

export type SettingsEventParameters = {
  'notification_settings.index_page_viewed': Record<string, unknown>;
  'notification_settings.tuning_page_viewed': {
    notification_type: string;
  };
  'notification_settings.updated_tuning_setting': {
    notification_type: string;
    tuning_field_type: string;
  };
  /**
   * A project was starred or unstarred from the organization avatar menu.
   */
  'settings.org_menu.project_bookmark_toggled': {
    bookmarked: boolean;
    source: SettingsOrgMenuProjectSource;
  };
  /**
   * A project was clicked in the organization avatar menu, opening its
   * project settings.
   */
  'settings.org_menu.project_clicked': {
    source: SettingsOrgMenuProjectSource;
  };
  /**
   * A different project was picked in the project selector at the top of the
   * project settings sidebar.
   */
  'settings.project_selector.changed': Record<string, unknown>;
  /**
   * A link outside of the settings navigation that opens a settings page was
   * clicked. `source` says which link.
   */
  'settings.settings_link_clicked': {
    source: SettingsLinkSource;
  };
  'sidebar.item_clicked': {
    dest: string;
    project_id?: string;
    sidebar_item_id?: string;
  };
};

type SettingsEventKey = keyof SettingsEventParameters;

export const settingsEventMap: Record<SettingsEventKey, string | null> = {
  'notification_settings.index_page_viewed': 'Notification Settings: Index Page Viewed',
  'notification_settings.tuning_page_viewed': 'Notification Settings: Tuning Page Viewed',
  'notification_settings.updated_tuning_setting':
    'Notification Settings: Updated Tuning Setting',
  'settings.org_menu.project_bookmark_toggled':
    'Settings: Organization Menu Project Star Toggled',
  'settings.org_menu.project_clicked': 'Settings: Organization Menu Project Clicked',
  'settings.project_selector.changed': 'Settings: Sidebar Project Selector Changed',
  'settings.settings_link_clicked': 'Settings: Settings Link Clicked',
  'sidebar.item_clicked': 'Sidebar: Item Clicked',
};
