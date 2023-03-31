import mapValues from 'lodash/mapValues';

import {t} from 'sentry/locale';
import {Organization, TagCollection} from 'sentry/types';
import {
  FieldKey,
  makeTagCollection,
  MobileVital,
  SpanOpBreakdown,
  WebVital,
} from 'sentry/utils/fields';
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

export enum MEPAlertsQueryType {
  ERROR = 0,
  PERFORMANCE = 1,
  CRASH_RATE = 2,
}

export enum MEPAlertsDataset {
  DISCOVER = 'discover',
  METRICS = 'metrics',
  METRICS_ENHANCED = 'metricsEnhanced',
}

export type MetricAlertType = Exclude<AlertType, 'issues'>;

export const DatasetMEPAlertQueryTypes: Record<Dataset, MEPAlertsQueryType> = {
  [Dataset.ERRORS]: MEPAlertsQueryType.ERROR,
  [Dataset.TRANSACTIONS]: MEPAlertsQueryType.PERFORMANCE,
  [Dataset.GENERIC_METRICS]: MEPAlertsQueryType.PERFORMANCE,
  [Dataset.METRICS]: MEPAlertsQueryType.CRASH_RATE,
  [Dataset.SESSIONS]: MEPAlertsQueryType.CRASH_RATE,
};

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

const TRANSACTION_SUPPORTED_TAGS = [
  FieldKey.RELEASE,
  FieldKey.TRANSACTION,
  FieldKey.TRANSACTION_OP,
  FieldKey.TRANSACTION_STATUS,
  FieldKey.HTTP_METHOD,
];
const SESSION_SUPPORTED_TAGS = [FieldKey.RELEASE];

// Some data sets support a very limited number of tags. For these cases,
// define all supported tags explicitly
export const DATASET_SUPPORTED_TAGS: Record<Dataset, TagCollection | undefined> =
  mapValues(
    {
      [Dataset.ERRORS]: undefined,
      [Dataset.TRANSACTIONS]: TRANSACTION_SUPPORTED_TAGS,
      [Dataset.METRICS]: SESSION_SUPPORTED_TAGS,
      [Dataset.GENERIC_METRICS]: TRANSACTION_SUPPORTED_TAGS,
      [Dataset.SESSIONS]: SESSION_SUPPORTED_TAGS,
    },
    value => {
      return value ? makeTagCollection(value) : undefined;
    }
  );

// Some data sets support all tags except some. For these cases, define the
// omissions only
export const DATASET_OMITTED_TAGS: Record<
  Dataset,
  Array<FieldKey | WebVital | MobileVital | SpanOpBreakdown> | undefined
> = {
  [Dataset.ERRORS]: [
    FieldKey.EVENT_TYPE,
    FieldKey.RELEASE_VERSION,
    FieldKey.RELEASE_STAGE,
    FieldKey.RELEASE_BUILD,
    FieldKey.PROJECT,
    ...Object.values(WebVital),
    ...Object.values(MobileVital),
    ...Object.values(SpanOpBreakdown),
    FieldKey.TRANSACTION,
    FieldKey.TRANSACTION_DURATION,
    FieldKey.TRANSACTION_OP,
    FieldKey.TRANSACTION_STATUS,
  ],
  [Dataset.TRANSACTIONS]: undefined,
  [Dataset.METRICS]: undefined,
  [Dataset.GENERIC_METRICS]: undefined,
  [Dataset.SESSIONS]: undefined,
};

export function getMEPAlertsDataset(
  dataset: Dataset,
  newAlert: boolean
): MEPAlertsDataset {
  // Dataset.ERRORS overrides all cases
  if (dataset === Dataset.ERRORS) {
    return MEPAlertsDataset.DISCOVER;
  }

  if (newAlert) {
    return MEPAlertsDataset.METRICS_ENHANCED;
  }

  if (dataset === Dataset.GENERIC_METRICS) {
    return MEPAlertsDataset.METRICS;
  }

  return MEPAlertsDataset.DISCOVER;
}
