import {t} from 'app/locale';

export const ALL_PROVIDERS = {
  email: 'default',
  slack: 'never',
};

/**
 * These values are stolen from the DB.
 */
export const VALUE_MAPPING = {
  default: 0,
  never: 10,
  always: 20,
  subscribe_only: 30,
  committed_only: 40,
};

export const MIN_PROJECTS_FOR_CONFIRMATION = 3;
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
  'approval',
  'reports',
  'email',
];

export const SELF_NOTIFICATION_SETTINGS_TYPES = [
  'personalActivityNotifications',
  'selfAssignOnResolve',
];

export const CONFIRMATION_MESSAGE = (
  <div>
    <p style={{marginBottom: '20px'}}>
      <strong>Are you sure you want to disable these notifications?</strong>
    </p>
    <p>
      {t(
        'Turning this off will irreversibly overwrite all of your fine-tuning settings to "off".'
      )}
    </p>
  </div>
);
