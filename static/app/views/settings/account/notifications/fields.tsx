import {t} from 'app/locale';

export type FineTuneField = {
  title: string;
  description: string;
  type: 'select';
  choices?: string[][];
  defaultValue?: string;
  defaultFieldName?: string;
};

export const ACCOUNT_NOTIFICATION_FIELDS: Record<string, FineTuneField> = {
  alerts: {
    title: 'Project Alerts',
    description: t('Control alerts that you receive per project.'),
    type: 'select',
    choices: [
      ['-1', t('Default')],
      ['1', t('On')],
      ['0', t('Off')],
    ],
    defaultValue: '-1',
    defaultFieldName: 'subscribeByDefault',
  },
  workflow: {
    title: 'Workflow Notifications',
    description: t(
      'Control workflow notifications, e.g. changes in issue assignment, resolution status, and comments.'
    ),
    type: 'select',
    choices: [
      ['-1', t('Default')],
      ['0', t('Always')],
      ['1', t('Only on issues I subscribe to')],
      ['2', t('Never')],
    ],
    defaultValue: '-1',
    defaultFieldName: 'workflowNotifications',
  },
  deploy: {
    title: t('Deploy Notifications'),
    description: t(
      'Control deploy notifications that include release, environment, and commit overviews.'
    ),
    type: 'select',
    choices: [
      ['-1', t('Default')],
      ['2', t('Always')],
      ['3', t('Only on deploys with my commits')],
      ['4', t('Never')],
    ],
    defaultValue: '-1',
    defaultFieldName: 'deployNotifications',
  },
  reports: {
    title: t('Weekly Reports'),
    description: t(
      "Reports contain a summary of what's happened within the organization."
    ),
    type: 'select',
    // API only saves organizations that have this disabled, so we should default to "On"
    defaultValue: '1',
    choices: [
      ['1', t('On')],
      ['0', t('Off')],
    ],
    defaultFieldName: 'weeklyReports',
  },

  email: {
    title: t('Email Routing'),
    description: t(
      'On a per project basis, route emails to an alternative email address.'
    ),
    type: 'select',
    // No choices here because it's going to have dynamic content
    // Component will create choices
  },
};
