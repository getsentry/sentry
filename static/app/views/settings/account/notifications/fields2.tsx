import {Fragment} from 'react';

import {Field} from 'sentry/components/forms/types';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
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
      ['committed_only', t('Releases with My Commits')],
      ['never', t('Off')],
    ],
    help: t('Release, environment, and commit overviews.'),
  },
  provider: {
    name: 'provider',
    type: 'select',
    label: t('Delivery Method'),
    choices: [
      ['email', t('Email')],
      ['slack', t('Slack')],
      ['msteams', t('Microsoft Teams')],
    ],
    help: t('Where personal notifications will be sent.'),
    multiple: true,
    onChange: val => {
      // This is a little hack to prevent this field from being empty.
      // TODO(nisanthan): need to prevent showing the clearable on. the multi-select when its only 1 value.
      if (!val || val.length === 0) {
        throw Error('Invalid selection. Field cannot be empty.');
      }
    },
  },
  approval: {
    name: 'approval',
    type: 'select',
    label: t('Nudges'),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ],
    help: t('Notifications that require review or approval.'),
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
    name: 'reports',
    type: 'select',
    label: t('Weekly Reports'),
    help: t('A summary of the past week for an organization.'),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ],
  },
  email: {
    name: 'email routing',
    type: 'blank',
    label: t('Email Routing'),
    help: t('Change the email address that receives notifications.'),
  },
  spikeProtection: {
    name: 'spikeProtection',
    type: 'select',
    label: t('Spike Protection'),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ],
    help: t('Notifications about spikes on a per project basis.'),
  },
  // legacy options
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
    label: t('Resolve and Auto-Assign'),
    choices: [
      [true as any, t('On')],
      [false as any, t('Off')],
    ],
    help: t("When you resolve an unassigned issue, we'll auto-assign it to you."),
  },
};

// partial field definition for quota sub-categories
export const QUOTA_FIELDS = [
  {
    name: 'quotaWarnings',
    label: t('Set Quota Limit'),
    help: t('Receive notifications when your organization exceeds the following limits.'),
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
    name: 'quotaReplays',
    label: t('Replays'),
    help: tct('Receive notifications about your replay quotas. [learnMore:Learn more]', {
      learnMore: <ExternalLink href={getDocsLinkForEventType('replay')} />,
    }),
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
  {
    name: 'quotaSpendAllocations',
    label: (
      <Fragment>
        {t('Spend Allocations')}{' '}
        <QuestionTooltip position="top" title="Business plan only" size="xs" />
      </Fragment>
    ),
    help: t('Receive notifications about your spend allocations.'),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ] as const,
  },
];
