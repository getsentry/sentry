export enum NotificationActionService {
  EMAIL = 'email',
  PAGERDUTY = 'pagerduty',
  SLACK = 'slack',
  MSTEAMS = 'msteams',
  OPSGENIE = 'opsgenie',
  DISCORD = 'discord',
  SENTRY_APP = 'sentry_app',
  SENTRY_NOTIFICATION = 'sentry_notification',
}

export type NotificationAction = {
  id: number;
  integrationId: number | null;
  organizationId: number;
  projects: number[];
  sentryAppId: number | null;
  serviceType: string;
  targetDisplay: string;
  targetIdentifier: string;
  targetType: string;
  triggerType: string;
};

export type AvailableNotificationAction = {
  action: {
    serviceType: string;
    targetType: string;
    triggerType: string;
    integrationId?: number;
    integrationName?: string;
    targetDisplay?: string;
    targetIdentifier?: string;
  };
  requires: {description: string; name: string}[];
};
