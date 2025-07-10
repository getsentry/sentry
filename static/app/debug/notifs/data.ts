import {NotificationCategory} from 'sentry/debug/notifs/types';

/** TODO(ecosystem): Use actual notification platform items, maybe via API? */
export const notificationCategories: NotificationCategory[] = [
  {
    label: 'Alerts',
    value: 'alerts',
    sources: [
      {
        value: 'issue-alert-triggered-error',
        label: 'Issue Alert Triggered (Error)',
        category: {label: 'Alerts', value: 'alerts'},
      },
      {
        value: 'issue-alert-triggered-performance',
        label: 'Issue Alert Triggered (Performance)',
        category: {label: 'Alerts', value: 'alerts'},
      },
      {
        value: 'metric-alert-critical',
        label: 'Metric Alert (Critical)',
        category: {label: 'Alerts', value: 'alerts'},
      },
      {
        value: 'metric-alert-warning',
        label: 'Metric Alert (Warning)',
        category: {label: 'Alerts', value: 'alerts'},
      },
      {
        value: 'metric-alert-resolved',
        label: 'Metric Alert (Resolved)',
        category: {label: 'Alerts', value: 'alerts'},
      },
    ],
  },
  {
    label: 'Workflow',
    value: 'workflow',
    sources: [
      {
        value: 'issue-assigned',
        label: 'Issue Assigned',
        category: {label: 'Workflow', value: 'workflow'},
      },
      {
        value: 'issue-archived',
        label: 'Issue Archived',
        category: {label: 'Workflow', value: 'workflow'},
      },
      {
        value: 'issue-resolved',
        label: 'Issue Resolved',
        category: {label: 'Workflow', value: 'workflow'},
      },
      {
        value: 'issue-resolved-in-release',
        label: 'Issue Resolved in Release',
        category: {label: 'Workflow', value: 'workflow'},
      },
      {
        value: 'issue-resolved-in-commit',
        label: 'Issue Resolved in Commit',
        category: {label: 'Workflow', value: 'workflow'},
      },
    ],
  },
  {
    label: 'Deploys',
    value: 'deploy',
    sources: [
      {
        value: 'deploy-created',
        label: 'Deploy Created',
        category: {label: 'Deploys', value: 'deploy'},
      },
    ],
  },
  {
    label: 'Nudges',
    value: 'approval',
    sources: [
      {
        value: 'member-request',
        label: 'Member Request',
        category: {label: 'Nudges', value: 'approval'},
      },
      {
        value: 'integration-request',
        label: 'Integration Request',
        category: {label: 'Nudges', value: 'approval'},
      },
    ],
  },
  {
    label: 'Spend',
    value: 'quota',
    sources: [
      {
        value: 'quota-exceeded',
        label: 'Quota Exceeded',
        category: {label: 'Spend', value: 'quota'},
      },
      {
        value: 'quota-warning',
        label: 'Quota Warning',
        category: {label: 'Spend', value: 'quota'},
      },
      {
        value: 'billing-error',
        label: 'Billing Error',
        category: {label: 'Spend', value: 'quota'},
      },
    ],
  },
  {
    label: 'Weekly Reports',
    value: 'reports',
    sources: [
      {
        value: 'daily-report',
        label: 'Daily Report',
        category: {label: 'Weekly Reports', value: 'reports'},
      },
      {
        value: 'weekly-report',
        label: 'Weekly Report',
        category: {label: 'Weekly Reports', value: 'reports'},
      },
    ],
  },
  {
    label: 'Spike Protection',
    value: 'spike-protection',
    sources: [
      {
        value: 'spike-protection-triggered',
        label: 'Spike Protection Triggered',
        category: {label: 'Spike Protection', value: 'spike-protection'},
      },
      {
        value: 'spike-protection-resolved',
        label: 'Spike Protection Resolved',
        category: {label: 'Spike Protection', value: 'spike-protection'},
      },
    ],
  },
];
