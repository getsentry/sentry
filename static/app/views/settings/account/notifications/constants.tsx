export const SUPPORTED_PROVIDERS = ['email', 'slack', 'msteams'] as const;
export type SupportedProviders = (typeof SUPPORTED_PROVIDERS)[number];

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
  'brokenMonitors',
] as const;

export const SELF_NOTIFICATION_SETTINGS_TYPES = [
  'personalActivityNotifications',
  'selfAssignOnResolve',
];

// 'alerts' | 'workflow' ...
type NotificationSettingsType = (typeof NOTIFICATION_SETTINGS_TYPES)[number];

export const NOTIFICATION_SETTINGS_PATHNAMES: Record<NotificationSettingsType, string> = {
  alerts: 'alerts',
  workflow: 'workflow',
  deploy: 'deploy',
  approval: 'approval',
  quota: 'quota',
  reports: 'reports',
  email: 'email',
  spikeProtection: 'spike-protection',
  brokenMonitors: 'broken-monitors',
};

export const NOTIFICATION_FEATURE_MAP: Partial<
  Record<NotificationSettingsType, string | string[]>
> = {
  quota: ['spend-visibility-notifications', 'user-spend-notifications-settings'],
  spikeProtection: 'spike-projections',
};
