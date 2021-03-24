import {t} from 'app/locale';
import {Dataset, EventTypes} from 'app/views/settings/incidentRules/types';

export type AlertType =
  | 'issues'
  | 'num_errors'
  | 'users_experiencing_errors'
  | 'throughput'
  | 'trans_duration'
  | 'lcp';

export const AlertWizardOptions: {
  categoryHeading: string;
  options: [AlertType, string][];
}[] = [
  {
    categoryHeading: t('Errors'),
    options: [
      ['issues', t('Issues')],
      ['num_errors', t('Number of Errors')],
      ['users_experiencing_errors', t('Users Experiencing Errors')],
    ],
  },
  {
    categoryHeading: t('Performance'),
    options: [
      ['throughput', t('Throughput')],
      ['trans_duration', t('Transaction Duration')],
      ['lcp', t('Longest Contentful Paint')],
    ],
  },
];

// TODO(davidenwang): Once the copy is finalized for the wizard fill this in with real content
export const AlertWizardDescriptions: Record<AlertType, string> = {
  issues: t('An issue alert allows you to alert on a group of error events in Sentry'),
  num_errors: t('Alert on the number of errors coming into your Sentry dashboard'),
  users_experiencing_errors: t('Alert on the number of users experiencing errors'),
  throughput: t('Alert on the number of transactions happening in your application'),
  trans_duration: t('Alert on the duration of transactions'),
  lcp: t('Alert on longest contentful paint'),
};

export type WizardRuleTemplate = {
  aggregate: string;
  dataset: Dataset;
  eventTypes: EventTypes;
};

export const AlertWizardRuleTemplates: Record<
  Exclude<AlertType, 'issues'>,
  WizardRuleTemplate
> = {
  num_errors: {
    aggregate: 'count()',
    dataset: Dataset.ERRORS,
    eventTypes: EventTypes.ERROR,
  },
  users_experiencing_errors: {
    aggregate: 'count_unique(tags[sentry:user])',
    dataset: Dataset.ERRORS,
    eventTypes: EventTypes.ERROR,
  },
  throughput: {
    aggregate: 'count()',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  trans_duration: {
    aggregate: 'p95(transaction.duration)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  lcp: {
    aggregate: 'p95(measurements.lcp)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
};
