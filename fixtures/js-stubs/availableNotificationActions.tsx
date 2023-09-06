import type {AvailableNotificationAction as AvailableNotificationActionType} from 'sentry/types';

export function AvailableNotificationActions(
  params: AvailableNotificationActionType[] = []
): {actions: AvailableNotificationActionType[]} {
  return {
    actions: [
      {
        action: {
          triggerType: 'spike-protection',
          serviceType: 'sentry_notification',
          targetType: 'specific',
          targetIdentifier: 'default',
          targetDisplay: 'default',
        },
        requires: [
          {
            name: 'projects',
            description: 'Project slugs which will receive the action',
          },
        ],
      },
      {
        action: {
          triggerType: 'spike-protection',
          serviceType: 'slack',
          targetType: 'specific',
          integrationId: 1,
          integrationName: 'sentry-ecosystem',
        },
        requires: [
          {
            name: 'projects',
            description: 'Project slugs which will receive the action',
          },
          {
            name: 'targetIdentifier',
            description: "Slack channel ID (e.g. 'C123ABC45DE')",
          },
          {
            name: 'targetDisplay',
            description: 'Slack channel name (e.g #sentry-spike-protection)',
          },
        ],
      },
      {
        action: {
          triggerType: 'spike-protection',
          serviceType: 'slack',
          targetType: 'specific',
          integrationId: 5,
          integrationName: 'sentry-enterprise',
        },
        requires: [
          {
            name: 'projects',
            description: 'Project slugs which will receive the action',
          },
          {
            name: 'targetIdentifier',
            description: "Slack channel ID (e.g. 'C123ABC45DE')",
          },
          {
            name: 'targetDisplay',
            description: 'Slack channel name (e.g #sentry-spike-protection)',
          },
        ],
      },
      {
        action: {
          triggerType: 'spike-protection',
          serviceType: 'pagerduty',
          targetType: 'specific',
          integrationId: 2,
          integrationName: 'sentry-enterprise',
          targetIdentifier: '3',
          targetDisplay: 'Default Service',
        },
        requires: [
          {
            name: 'projects',
            description: 'Project slugs which will receive the action',
          },
        ],
      },
      {
        action: {
          triggerType: 'spike-protection',
          serviceType: 'pagerduty',
          targetType: 'specific',
          integrationId: 2,
          integrationName: 'sentry-enterprise',
          targetIdentifier: '2',
          targetDisplay: 'Test 2',
        },
        requires: [
          {
            name: 'projects',
            description: 'Project slugs which will receive the action',
          },
        ],
      },
      {
        action: {
          triggerType: 'spike-protection',
          serviceType: 'pagerduty',
          targetType: 'specific',
          integrationId: 2,
          integrationName: 'sentry-enterprise',
          targetIdentifier: '1',
          targetDisplay: 'Test 1',
        },
        requires: [
          {
            name: 'projects',
            description: 'Project slugs which will receive the action',
          },
        ],
      },
      {
        action: {
          triggerType: 'spike-protection',
          serviceType: 'opsgenie',
          targetType: 'specific',
          integrationId: 3,
          integrationName: 'sentry-enterprise',
          targetIdentifier: '1-opsgenie-test-team-2',
          targetDisplay: 'opsgenie-test-team-2',
        },
        requires: [
          {
            name: 'projects',
            description: 'Project slugs which will receive the action',
          },
        ],
      },
      {
        action: {
          triggerType: 'spike-protection',
          serviceType: 'opsgenie',
          targetType: 'specific',
          integrationId: 3,
          integrationName: 'sentry-enterprise',
          targetIdentifier: '1-opsgenie-test-team',
          targetDisplay: 'opsgenie-test-team',
        },
        requires: [
          {
            name: 'projects',
            description: 'Project slugs which will receive the action',
          },
        ],
      },
      ...params,
    ],
  };
}
