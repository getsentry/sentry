import {t} from 'app/locale';
import {SelectValue} from 'app/types';

export type FineTuneField = {
  title: string;
  description: string;
  type: 'select';
  options?: SelectValue<string>[];
  defaultValue?: string;
  defaultFieldName?: string;
};

// TODO: clean up unused fields
export const ACCOUNT_NOTIFICATION_FIELDS: Record<string, FineTuneField> = {
  alerts: {
    title: 'Project Alerts',
    description: t(
      'Notifications from Alert Rules that your team has setup. You’ll always receive notifications from Alerts configured to be sent directly to you.'
    ),
    type: 'select',
    options: [
      {value: '-1', label: t('Default')},
      {value: '1', label: t('On')},
      {value: '0', label: t('Off')},
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
    options: [
      {value: '-1', label: t('Default')},
      {value: '0', label: t('Always')},
      {value: '1', label: t('Only on issues I subscribe to')},
      {value: '2', label: t('Never')},
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
    options: [
      {value: '-1', label: t('Default')},
      {value: '2', label: t('Always')},
      {value: '3', label: t('Only on deploys with my commits')},
      {value: '4', label: t('Never')},
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
    options: [
      {value: '1', label: t('On')},
      {value: '0', label: t('Off')},
    ],
    defaultFieldName: 'weeklyReports',
  },
  approval: {
    title: t('Approvals'),
    description: t('Notifications from teammates that require review or approval.'),
    type: 'select',
    // No choices here because it's going to have dynamic content
    // Component will create choices,
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
