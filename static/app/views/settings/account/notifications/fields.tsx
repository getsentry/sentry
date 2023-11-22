import {t} from 'sentry/locale';
import {SelectValue} from 'sentry/types';

export type FineTuneField = {
  description: string;
  title: string;
  type: 'select';
  defaultValue?: string;
  options?: SelectValue<string>[];
};

// TODO: clean up unused fields
export const ACCOUNT_NOTIFICATION_FIELDS: Record<string, FineTuneField> = {
  alerts: {
    title: t('Issue Alert Notifications'),
    description: t(
      "Notifications from Alert Rules that your team has setup. You'll always receive notifications from Alerts configured to be sent directly to you."
    ),
    type: 'select',
    options: [
      {value: '1', label: t('On')},
      {value: '0', label: t('Off')},
    ],
  },
  workflow: {
    title: t('Workflow Notifications'),
    description: t(
      'Control workflow notifications, e.g. changes in issue assignment, resolution status, and comments.'
    ),
    type: 'select',
    options: [
      {value: '0', label: t('Always')},
      {value: '1', label: t('Only on issues I subscribe to')},
      {value: '2', label: t('Never')},
    ],
  },
  deploy: {
    title: t('Deploy Notifications'),
    description: t(
      'Control deploy notifications that include release, environment, and commit overviews.'
    ),
    type: 'select',
    options: [
      {value: '2', label: t('Always')},
      {value: '3', label: t('Only on deploys with my commits')},
      {value: '4', label: t('Never')},
    ],
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
  },
  approval: {
    title: t('Nudges'),
    description: t('Notifications that require review or approval.'),
    type: 'select',
    // No choices here because it's going to have dynamic content
    // Component will create choices,
  },
  quota: {
    title: t('Quota Notifications'),
    description: t(
      'Control the notifications you receive for error, transaction, and attachment quota limits.'
    ),
    type: 'select',
    // No choices here because it's going to have dynamic content
    // Component will create choices,
  },
  spikeProtection: {
    title: t('Spike Protection Notifications'),
    description: t(
      'Notifications about spikes on projects that you have enabled spike protection for.'
    ),
    type: 'select',
    defaultValue: '1',
    options: [
      {value: '1', label: t('On')},
      {value: '0', label: t('Off')},
    ],
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
