import {t} from 'sentry/locale';

export const ALL_PROVIDERS = {
  email: 'default',
  slack: 'never',
  msteams: 'never',
};
export const ALL_PROVIDER_NAMES = Object.keys(ALL_PROVIDERS);

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

export const SUPPORTED_PROVIDERS = ['email', 'slack', 'msteams'] as const;
export type SupportedProviders = (typeof SUPPORTED_PROVIDERS)[number];

export const MIN_PROJECTS_FOR_CONFIRMATION = 3;
export const MIN_PROJECTS_FOR_SEARCH = 3;
export const MIN_PROJECTS_FOR_PAGINATION = 100;
export type ProviderValue = 'always' | 'never';

interface NotificationBaseObject {
  id: string;
  scopeIdentifier: string;
  scopeType: string;
  type: string;
}

export interface NotificationOptionsObject extends NotificationBaseObject {
  value: ProviderValue | 'subscribe_only' | 'committed_only';
}

export interface NotificationProvidersObject extends NotificationBaseObject {
  provider: SupportedProviders;
  value: ProviderValue;
}

export interface DefaultSettings {
  providerDefaults: SupportedProviders[];
  typeDefaults: Record<string, ProviderValue>;
}

export const NOTIFICATION_SETTINGS_TYPES = [
  'alerts',
  'workflow',
  'deploy',
  'approval',
  'quota',
  'reports',
  'email',
  'spikeProtection',
] as const;

export const SELF_NOTIFICATION_SETTINGS_TYPES = [
  'personalActivityNotifications',
  'selfAssignOnResolve',
];

// 'alerts' | 'workflow' ...
export type NotificationSettingsType = (typeof NOTIFICATION_SETTINGS_TYPES)[number];

export const NOTIFICATION_SETTINGS_PATHNAMES: Record<NotificationSettingsType, string> = {
  alerts: 'alerts',
  workflow: 'workflow',
  deploy: 'deploy',
  approval: 'approval',
  quota: 'quota',
  reports: 'reports',
  email: 'email',
  spikeProtection: 'spike-protection',
};

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

export const NOTIFICATION_FEATURE_MAP: Partial<Record<NotificationSettingsType, string>> =
  {
    quota: 'slack-overage-notifications',
    spikeProtection: 'spike-projections',
  };
