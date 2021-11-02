import * as React from 'react';

import {t} from 'app/locale';

export type NotificationSettingField = {
  name: string;
  type: 'select' | 'blank' | 'boolean';
  label: string;
  choices?: string[][];
  defaultValue?: string;
  defaultFieldName?: string;
  help?: string;
  confirm?: {[key: string]: React.ReactNode | string};
};

export const NOTIFICATION_SETTING_FIELDS: Record<string, NotificationSettingField> = {
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
    type: 'boolean',
    label: t('My Own Activity'),
    help: t('Notifications about your own actions on Sentry.'),
  },
  selfAssignOnResolve: {
    name: 'selfAssignOnResolve',
    type: 'boolean',
    label: t('Claim Unassigned Issues I’ve Resolved'),
    help: t('You’ll receive notifications about any changes that happen afterwards.'),
  },
};
