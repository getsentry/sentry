import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {
  Dataset,
  EventTypes,
  SessionsAggregate,
} from 'sentry/views/alerts/rules/metric/types';

export type AlertType =
  | 'issues'
  | 'num_errors'
  | 'users_experiencing_errors'
  | 'throughput'
  | 'trans_duration'
  | 'apdex'
  | 'failure_rate'
  | 'lcp'
  | 'fid'
  | 'cls'
  | 'custom'
  | 'crash_free_sessions'
  | 'crash_free_users';

export type MetricAlertType = Exclude<AlertType, 'issues'>;

export const AlertWizardAlertNames: Record<AlertType, string> = {
  issues: t('Issues'),
  num_errors: t('Number of Errors'),
  users_experiencing_errors: t('Users Experiencing Errors'),
  throughput: t('Throughput'),
  trans_duration: t('Transaction Duration'),
  apdex: t('Apdex'),
  failure_rate: t('Failure Rate'),
  lcp: t('Largest Contentful Paint'),
  fid: t('First Input Delay'),
  cls: t('Cumulative Layout Shift'),
  custom: t('Custom Metric'),
  crash_free_sessions: t('Crash Free Session Rate'),
  crash_free_users: t('Crash Free User Rate'),
};

type AlertWizardCategory = {
  categoryHeading: string;
  options: AlertType[];
};
export const getAlertWizardCategories = (org: Organization): AlertWizardCategory[] => [
  {
    categoryHeading: t('Errors'),
    options: ['issues', 'num_errors', 'users_experiencing_errors'],
  },
  ...(org.features.includes('crash-rate-alerts')
    ? [
        {
          categoryHeading: t('Sessions'),
          options: ['crash_free_sessions', 'crash_free_users'] as AlertType[],
        },
      ]
    : []),
  {
    categoryHeading: t('Performance'),
    options: [
      'throughput',
      'trans_duration',
      'apdex',
      'failure_rate',
      'lcp',
      'fid',
      'cls',
    ],
  },
  {
    categoryHeading: t('Other'),
    options: ['custom'],
  },
];

export type WizardRuleTemplate = {
  aggregate: string;
  dataset: Dataset;
  eventTypes: EventTypes;
};

export const AlertWizardRuleTemplates: Record<
  MetricAlertType,
  Readonly<WizardRuleTemplate>
> = {
  num_errors: {
    aggregate: 'count()',
    dataset: Dataset.ERRORS,
    eventTypes: EventTypes.ERROR,
  },
  users_experiencing_errors: {
    aggregate: 'count_unique(user)',
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
  apdex: {
    aggregate: 'apdex(300)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  failure_rate: {
    aggregate: 'failure_rate()',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  lcp: {
    aggregate: 'p95(measurements.lcp)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  fid: {
    aggregate: 'p95(measurements.fid)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  cls: {
    aggregate: 'p95(measurements.cls)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  custom: {
    aggregate: 'p95(measurements.fp)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  crash_free_sessions: {
    aggregate: SessionsAggregate.CRASH_FREE_SESSIONS,
    // TODO(scttcper): Use Dataset.Metric on GA of alert-crash-free-metrics
    dataset: Dataset.SESSIONS,
    eventTypes: EventTypes.SESSION,
  },
  crash_free_users: {
    aggregate: SessionsAggregate.CRASH_FREE_USERS,
    // TODO(scttcper): Use Dataset.Metric on GA of alert-crash-free-metrics
    dataset: Dataset.SESSIONS,
    eventTypes: EventTypes.USER,
  },
};

export const DEFAULT_WIZARD_TEMPLATE = AlertWizardRuleTemplates.num_errors;

export const hidePrimarySelectorSet = new Set<AlertType>([
  'num_errors',
  'users_experiencing_errors',
  'throughput',
  'apdex',
  'failure_rate',
  'crash_free_sessions',
  'crash_free_users',
]);

export const hideParameterSelectorSet = new Set<AlertType>([
  'trans_duration',
  'lcp',
  'fid',
  'cls',
]);

export function getFunctionHelpText(alertType: AlertType): {
  labelText: string;
  timeWindowText?: string;
} {
  const timeWindowText = t('over');
  if (alertType === 'apdex') {
    return {
      labelText: t('Select apdex threshold and time interval'),
      timeWindowText,
    };
  }
  if (hidePrimarySelectorSet.has(alertType)) {
    return {
      labelText: t('Select time interval'),
    };
  }
  return {
    labelText: t('Select function and time interval'),
    timeWindowText,
  };
}
