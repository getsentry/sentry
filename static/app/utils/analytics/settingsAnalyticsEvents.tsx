import type {SettingsScope} from 'sentry/views/settings/settingsScope';

/**
 * Links outside of the settings navigation that take people into settings.
 */
export type SettingsEntryPoint =
  | 'org_menu_settings'
  | 'user_menu_settings'
  | 'project_page_filter'
  | 'project_details_menu'
  | 'project_card';

/**
 * Where a project was picked from in the organization menu.
 * `quick_access` is the "Project Settings" section, `all_projects` is the
 * "View All Projects" submenu.
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
  'settings.entry_point_clicked': {
    entry_point: SettingsEntryPoint;
  };
  'settings.org_menu.project_bookmark_toggled': {
    bookmarked: boolean;
    source: SettingsOrgMenuProjectSource;
  };
  'settings.org_menu.project_clicked': {
    source: SettingsOrgMenuProjectSource;
  };
  'settings.page_viewed': {
    /**
     * False when the previous page was outside of settings.
     */
    from_settings: boolean;
    /**
     * The parameterized route, e.g. `/settings/:orgId/projects/:projectId/alerts/`.
     */
    path: string;
    scope: SettingsScope;
  };
  'settings.project_selector.changed': Record<string, unknown>;
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
  'settings.entry_point_clicked': 'Settings: Entry Point Clicked',
  'settings.org_menu.project_bookmark_toggled':
    'Settings: Org Menu Project Bookmark Toggled',
  'settings.org_menu.project_clicked': 'Settings: Org Menu Project Clicked',
  'settings.page_viewed': 'Settings: Page Viewed',
  'settings.project_selector.changed': 'Settings: Project Selector Changed',
  'sidebar.item_clicked': 'Sidebar: Item Clicked',
};
