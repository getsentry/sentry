import {NotificationCategory} from 'sentry/debug/notifs/types';

/** TODO(ecosystem): Use actual notification platform items, maybe via API? */
export const notificationCategories: NotificationCategory[] = [
  {
    label: 'Alerts',
    value: 'alerts',
    sources: [
      'issue-alert-triggered-error',
      'issue-alert-triggered-performance',
      'metric-alert-critical',
      'metric-alert-warning',
      'metric-alert-resolved',
    ],
  },
  {
    label: 'Workflow',
    value: 'workflow',
    sources: [
      'issue-assigned',
      'issue-archived',
      'issue-resolved',
      'issue-resolved-in-release',
      'issue-resolved-in-commit',
    ],
  },
  {label: 'Deploys', value: 'deploy', sources: ['deploy-created']},
  {
    label: 'Nudges',
    value: 'approval',
    sources: ['member-request', 'integration-request'],
  },
  {
    label: 'Spend',
    value: 'quota',
    sources: ['quota-exceeded', 'quota-warning', 'billing-error'],
  },
  {
    label: 'Weekly Reports',
    value: 'reports',
    sources: ['daily-report', 'weekly-report'],
  },
  {
    label: 'Spike Protection',
    value: 'spike-protection',
    sources: ['spike-protection-triggered', 'spike-protection-resolved'],
  },
];
