export const ALL_PROVIDERS = {
  email: 'default',
  slack: 'never',
};

/** These values are stolen from the DB. */
export const VALUE_MAPPING = {
  default: 0,
  never: 10,
  always: 20,
  subscribe_only: 30,
  committed_only: 40,
};

export const MIN_PROJECTS_FOR_SEARCH = 3;
export const MIN_PROJECTS_FOR_PAGINATION = 100;

export type NotificationSettingsByProviderObject = {[key: string]: string};
export type NotificationSettingsObject = {
  [key: string]: {[key: string]: {[key: string]: NotificationSettingsByProviderObject}};
};

export const NOTIFICATION_SETTINGS_TYPES = [
  'alerts',
  'workflow',
  'deploy',
  'reports',
  'email',
];

export const SELF_NOTIFICATION_SETTINGS_TYPES = [
  'personalActivityNotifications',
  'selfAssignOnResolve',
];
