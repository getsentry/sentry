import mapValues from 'lodash/mapValues';

import {t} from 'sentry/locale';
import {Organization, TagCollection} from 'sentry/types';
import {
  FieldKey,
  makeTagCollection,
  MobileVital,
  ReplayClickFieldKey,
  ReplayFieldKey,
  SpanOpBreakdown,
  WebVital,
} from 'sentry/utils/fields';
import {ON_DEMAND_METRICS_UNSUPPORTED_TAGS} from 'sentry/utils/onDemandMetrics/constants';
import {shouldShowOnDemandMetricAlertUI} from 'sentry/utils/onDemandMetrics/features';
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
  FieldKey.HTTP_STATUS_CODE,
  FieldKey.BROWSER_NAME,
  FieldKey.GEO_COUNTRY_CODE,
  FieldKey.OS_NAME,
];
const SESSION_SUPPORTED_TAGS = [FieldKey.RELEASE];

// This is purely for testing purposes, use with alert-allow-indexed feature flag
const INDEXED_PERFORMANCE_ALERTS_OMITTED_TAGS = [
  FieldKey.AGE,
  FieldKey.ASSIGNED,
  FieldKey.ASSIGNED_OR_SUGGESTED,
  FieldKey.BOOKMARKS,
  FieldKey.DEVICE_MODEL_ID,
  FieldKey.EVENT_TIMESTAMP,
  FieldKey.EVENT_TYPE,
  FieldKey.FIRST_RELEASE,
  FieldKey.FIRST_SEEN,
  FieldKey.IS,
  FieldKey.ISSUE_CATEGORY,
  FieldKey.ISSUE_TYPE,
  FieldKey.LAST_SEEN,
  FieldKey.PLATFORM_NAME,
  ...Object.values(WebVital),
  ...Object.values(MobileVital),
  ...Object.values(ReplayFieldKey),
  ...Object.values(ReplayClickFieldKey),
];

// Some data sets support a very limited number of tags. For these cases,
// define all supported tags explicitly
export function datasetSupportedTags(
  dataset: Dataset,
  org: Organization
): TagCollection | undefined {
  return mapValues(
    {
      [Dataset.ERRORS]: undefined,
      [Dataset.TRANSACTIONS]: org.features.includes('alert-allow-indexed')
        ? undefined
        : transactionSupportedTags(org),
      [Dataset.METRICS]: SESSION_SUPPORTED_TAGS,
      [Dataset.GENERIC_METRICS]: org.features.includes('alert-allow-indexed')
        ? undefined
        : transactionSupportedTags(org),
      [Dataset.SESSIONS]: SESSION_SUPPORTED_TAGS,
    },
    value => {
      return value ? makeTagCollection(value) : undefined;
    }
  )[dataset];
}

function transactionSupportedTags(org: Organization) {
  if (shouldShowOnDemandMetricAlertUI(org)) {
    // on-demand metrics support all tags, except the ones defined in ommited tags
    return undefined;
  }
  return TRANSACTION_SUPPORTED_TAGS;
}

// Some data sets support all tags except some. For these cases, define the
// omissions only
export function datasetOmittedTags(
  dataset: Dataset,
  org: Organization
):
  | Array<
      | FieldKey
      | WebVital
      | MobileVital
      | SpanOpBreakdown
      | ReplayFieldKey
      | ReplayClickFieldKey
    >
  | undefined {
  return {
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
    [Dataset.TRANSACTIONS]: transactionOmittedTags(org),
    [Dataset.METRICS]: undefined,
    [Dataset.GENERIC_METRICS]: transactionOmittedTags(org),
    [Dataset.SESSIONS]: undefined,
  }[dataset];
}

function transactionOmittedTags(org: Organization) {
  if (shouldShowOnDemandMetricAlertUI(org)) {
    return [...ON_DEMAND_METRICS_UNSUPPORTED_TAGS];
  }
  return org.features.includes('alert-allow-indexed')
    ? INDEXED_PERFORMANCE_ALERTS_OMITTED_TAGS
    : undefined;
}

export function getSupportedAndOmittedTags(dataset: Dataset, organization: Organization) {
  const omitTags = datasetOmittedTags(dataset, organization);
  const supportedTags = datasetSupportedTags(dataset, organization);

  const result = {omitTags, supportedTags};

  // remove undefined values, since passing explicit undefined to the SeachBar overrides its defaults
  return Object.keys({omitTags, supportedTags}).reduce((acc, key) => {
    if (result[key] !== undefined) {
      acc[key] = result[key];
    }
    return acc;
  }, {});
}

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
