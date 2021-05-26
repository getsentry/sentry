import {t} from 'app/locale';

export type NotificationSettingField = {
  name: string;
  type: 'select' | 'blank' | 'boolean';
  label: string;
  choices?: string[][];
  defaultValue?: string;
  defaultFieldName?: string;
  help?: string;
};

export const NOTIFICATION_SETTING_FIELDS: Record<string, NotificationSettingField> = {
  alerts: {
    name: 'alerts',
    type: 'select',
    label: t('Issue Alert Notifications'),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ],
    help: t('Enable this to receive notifications sent from project alerts.'),
  },
  deploy: {
    name: 'deploy',
    type: 'select',
    label: t('Deploy Notifications'),
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
  workflow: {
    name: 'workflow',
    type: 'select',
    label: t('Workflow Notifications'),
    choices: [
      ['always', t('On')],
      ['subscribe_only', t('Only Subscribed Issues')],
      ['never', t('Off')],
    ],
    help: t('Changes in issue assignment, resolution status, and comments.'),
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
    help: t('Select which email address should receive notifications per project.'),
  },
  personalActivityNotifications: {
    name: 'personalActivityNotifications',
    type: 'boolean',
    label: t('Notify Me About My Own Activity'),
    help: t('Enable this to receive notifications about your own actions on Sentry.'),
  },
  selfAssignOnResolve: {
    name: 'selfAssignOnResolve',
    type: 'boolean',
    label: t("Claim Unassigned Issues I've Resolved"),
    help: t("You'll receive notifications about any changes that happen afterwards."),
  },
};
