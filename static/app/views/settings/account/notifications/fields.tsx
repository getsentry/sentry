import {Fragment} from 'react';
import upperFirst from 'lodash/upperFirst';

import {ExternalLink} from '@sentry/scraps/link';

import type {Field} from 'sentry/components/forms/types';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import {DataCategoryExact} from 'sentry/types/core';
import {getPricingDocsLinkForEventType} from 'sentry/views/settings/account/notifications/utils';

export type FineTuneField = {
  description: string;
  title: string;
  type: 'select';
  defaultValue?: string;
  options?: Array<SelectValue<string>>;
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
  brokenMonitors: {
    title: t('Broken Cron Monitors'),
    description: t(
      'Notifications for Cron Monitors that have been in a failing state for a prolonged period of time'
    ),
    type: 'select',
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

export const NOTIFICATION_SETTING_FIELDS = {
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
        throw new Error('Invalid selection. Field cannot be empty.');
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
    choices: undefined,
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
    label: t('Broken Cron Monitors'),
    choices: [
      ['always', t('On')],
      ['never', t('Off')],
    ],
    help: t(
      'Notifications for Cron Monitors that have been in a failing state for a prolonged period of time'
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
} satisfies Record<string, Field>;

const CATEGORY_QUOTA_FIELDS = Object.values(DATA_CATEGORY_INFO)
  .filter(
    categoryInfo =>
      categoryInfo.isBilledCategory &&
      // Exclude Seer categories as they will be handled by a combined quotaSeerBudget field
      categoryInfo.name !== DataCategoryExact.SEER_AUTOFIX &&
      categoryInfo.name !== DataCategoryExact.SEER_SCANNER
  )
  .map(categoryInfo => {
    return {
      name: 'quota' + upperFirst(categoryInfo.plural),
      label: categoryInfo.titleName,
      help: tct(
        `Receive notifications about your [displayName] quotas. [learnMore:Learn more]`,
        {
          displayName: categoryInfo.displayName,
          learnMore: (
            <ExternalLink href={getPricingDocsLinkForEventType(categoryInfo.name)} />
          ),
        }
      ),
      choices: [
        ['always', t('On')],
        ['never', t('Off')],
      ] as const,
    };
  });

// Define the combined Seer budget field
const quotaSeerBudgetField = {
  // This maps to NotificationSettingEnum.QUOTA_SEER_BUDGET
  name: 'quotaSeerBudget',
  label: t('Seer Budget'),
  help: tct(`Receive notifications for your Seer budget. [learnMore:Learn more]`, {
    learnMore: (
      <ExternalLink
        href={getPricingDocsLinkForEventType(DataCategoryExact.SEER_AUTOFIX)}
      />
    ),
  }),
  choices: [
    ['always', t('On')],
    ['never', t('Off')],
  ] as const,
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
  ...CATEGORY_QUOTA_FIELDS,
  quotaSeerBudgetField,
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
          <ExternalLink href="https://docs.sentry.io/product/alerts/notifications/#spend-notifications" />
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
