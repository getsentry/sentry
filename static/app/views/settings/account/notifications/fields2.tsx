import {Field} from 'sentry/components/forms/type';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {getDocsLinkForEventType} from 'sentry/views/settings/account/notifications/utils';

export const NOTIFICATION_SETTING_FIELDS: Record<string, Field> = {
  alerts: {
    name: 'alerts',
    type: 'select',
    label: t('Issue Alerts'),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ],
    help: t('Notifications sent from Alert rules that your team has set up.'),
  },
  workflow: {
    name: 'workflow',
    type: 'select',
    label: t('Issue Workflow'),
    choices: [
      ['always', t('On')],
      ['subscribe_only', t('Only Subscribed Issues')],
      ['never', t('Off')],
    ],
    help: t('Changes in issue assignment, resolution status, and comments.'),
  },
  deploy: {
    name: 'deploy',
    type: 'select',
    label: t('Deploys'),
    choices: [
      ['always', t('On')],
      ['committed_only', t('Only Committed Issues')],
      ['never', t('Off')],
    ],
    help: t('Release, environment, and commit overviews.'),
  },
  provider: {
    name: 'provider',
    type: 'select',
    label: t('Delivery Method'),
    choices: [
      ['email', t('Send to Email')],
      ['slack', t('Send to Slack')],
      ['email+slack', t('Send to Email and Slack')],
    ],
  },
  approval: {
    name: 'approval',
    type: 'select',
    label: t('Approvals'),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ],
    help: t('Notifications from teammates that require review or approval.'),
  },
  quota: {
    name: 'quota',
    type: 'select',
    label: t('Quota'),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ],
    help: t('Error, transaction, and attachment quota limits.'),
  },
  reports: {
    name: 'weekly reports',
    type: 'blank',
    label: t('Weekly Reports'),
    help: t('A summary of the past week for an organization.'),
  },
  email: {
    name: 'email routing',
    type: 'blank',
    label: t('Email Routing'),
    help: t('Change the email address that receives notifications.'),
  },
  personalActivityNotifications: {
    name: 'personalActivityNotifications',
    type: 'select',
    label: t('My Own Activity'),
    choices: [
      [true as any, t('On')],
      [false as any, t('Off')],
    ],
    help: t('Notifications about your own actions on Sentry.'),
  },
  selfAssignOnResolve: {
    name: 'selfAssignOnResolve',
    type: 'select',
    label: t('Claim Unassigned Issues I’ve Resolved'),
    choices: [
      [true as any, t('On')],
      [false as any, t('Off')],
    ],
    help: t('You’ll receive notifications about any changes that happen afterwards.'),
  },
};

// partial field definition for quota sub-categories
export const QUOTA_FIELDS = [
  {
    name: 'quotaWarnings',
    label: t('Set Quota Limit'),
    help: t(
      'Receive notifications when your organization exceeeds the following limits.'
    ),
    choices: [
      ['always', t('100% and 80%')],
      ['never', t('100%')],
    ] as const,
  },
  {
    name: 'quotaErrors',
    label: t('Errors'),
    help: tct('Receive notifications about your error quotas. [learnMore:Learn more]', {
      learnMore: <ExternalLink href={getDocsLinkForEventType('error')} />,
    }),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ] as const,
  },
  {
    name: 'quotaTransactions',
    label: t('Transactions'),
    help: tct(
      'Receive notifications about your transaction quota. [learnMore:Learn more]',
      {
        learnMore: <ExternalLink href={getDocsLinkForEventType('transaction')} />,
      }
    ),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ] as const,
  },
  {
    name: 'quotaAttachments',
    label: t('Attachments'),
    help: tct(
      'Receive notifications about your attachment quota. [learnMore:Learn more]',
      {
        learnMore: <ExternalLink href={getDocsLinkForEventType('attachment')} />,
      }
    ),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ] as const,
  },
];
