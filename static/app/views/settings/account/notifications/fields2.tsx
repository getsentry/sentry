import {Fragment} from 'react';
import upperFirst from 'lodash/upperFirst';

import type {Field} from 'sentry/components/forms/types';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
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
    help: t('Error, transaction, replay, attachment, and cron monitor quota limits.'),
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
  brokenMonitors: {
    name: 'brokenMonitors',
    type: 'select',
    label: t('Broken Monitors'),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ],
    help: t(
      'Notifications for monitors that have been in a failing state for a prolonged period of time'
    ),
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

const CATEGORY_QUOTA_FIELDS = Object.values(DATA_CATEGORY_INFO)
  .filter(categoryInfo => categoryInfo.isBilledCategory)
  .map(categoryInfo => {
    return {
      name: 'quota' + upperFirst(categoryInfo.plural),
      label: categoryInfo.titleName,
      help: tct(
        `Receive notifications about your [displayName] quotas. [learnMore:Learn more]`,
        {
          displayName: categoryInfo.displayName,
          learnMore: <ExternalLink href={getDocsLinkForEventType(categoryInfo.name)} />,
        }
      ),
      choices: [
        ['always', t('On')],
        ['never', t('Off')],
      ] as const,
    };
  });

// TODO(isabella): Once spend vis notifs are GA, remove this
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
  ...CATEGORY_QUOTA_FIELDS,
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

export const SPEND_FIELDS = [
  {
    name: 'quota',
    label: t('Spend Notifications'),
    help: tct(
      'Receive notifications when your spend crosses predefined or custom thresholds. [learnMore:Learn more]',
      {
        learnMore: (
          <ExternalLink
            href={
              'https://docs.sentry.io/product/alerts/notifications/#spend-notifications'
            }
          />
        ),
      }
    ),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ] as const,
  },
  ...QUOTA_FIELDS.slice(1),
];
