import mapValues from 'lodash/mapValues';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {STATIC_FIELD_TAGS_WITHOUT_TRANSACTION_FIELDS} from 'sentry/components/events/searchBarFieldConstants';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {
  FieldKey,
  makeTagCollection,
  MobileVital,
  ReplayClickFieldKey,
  ReplayFieldKey,
  SpanOpBreakdown,
  WebVital,
} from 'sentry/utils/fields';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
import {
  DEFAULT_EAP_METRICS_ALERT_FIELD,
  DEFAULT_METRIC_ALERT_FIELD,
} from 'sentry/utils/metrics/mri';
import {ON_DEMAND_METRICS_UNSUPPORTED_TAGS} from 'sentry/utils/onDemandMetrics/constants';
import {shouldShowOnDemandMetricAlertUI} from 'sentry/utils/onDemandMetrics/features';
import {
  Dataset,
  EventTypes,
  SessionsAggregate,
} from 'sentry/views/alerts/rules/metric/types';
import {hasEAPAlerts} from 'sentry/views/insights/common/utils/hasEAPAlerts';
import {MODULE_TITLE as LLM_MONITORING_MODULE_TITLE} from 'sentry/views/insights/llmMonitoring/settings';

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
  | 'crash_free_sessions'
  | 'crash_free_users'
  | 'custom_transactions'
  | 'custom_metrics'
  | 'llm_tokens'
  | 'llm_cost'
  | 'uptime_monitor'
  | 'eap_metrics';

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

export type MetricAlertType = Exclude<AlertType, 'issues' | 'uptime_monitor'>;

export const DatasetMEPAlertQueryTypes: Record<
  Exclude<Dataset, Dataset.ISSUE_PLATFORM | Dataset.SESSIONS | Dataset.REPLAYS>, // IssuePlatform (search_issues) is not used in alerts, so we can exclude it here
  MEPAlertsQueryType
> = {
  [Dataset.ERRORS]: MEPAlertsQueryType.ERROR,
  [Dataset.TRANSACTIONS]: MEPAlertsQueryType.PERFORMANCE,
  [Dataset.GENERIC_METRICS]: MEPAlertsQueryType.PERFORMANCE,
  [Dataset.METRICS]: MEPAlertsQueryType.CRASH_RATE,
  [Dataset.EVENTS_ANALYTICS_PLATFORM]: MEPAlertsQueryType.PERFORMANCE,
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
  custom_metrics: t('Custom Metric'),
  custom_transactions: t('Custom Measurement'),
  crash_free_sessions: t('Crash Free Session Rate'),
  crash_free_users: t('Crash Free User Rate'),
  llm_cost: t('LLM cost'),
  llm_tokens: t('LLM token usage'),
  uptime_monitor: t('Uptime Monitor'),
  eap_metrics: t('Spans'),
};

/**
 * Additional elements to render after the name of the alert rule type. Useful
 * for adding feature badges or other call-outs for newer alert types.
 */
export const AlertWizardExtraContent: Partial<Record<AlertType, React.ReactNode>> = {
  eap_metrics: (
    <FeatureBadge
      type="beta"
      title={t('This feature is available for early adopters and the UX may change')}
    />
  ),
  uptime_monitor: <FeatureBadge type="beta" />,
};

type AlertWizardCategory = {
  categoryHeading: string;
  options: AlertType[];
};
export const getAlertWizardCategories = (org: Organization) => {
  const result: AlertWizardCategory[] = [
    {
      categoryHeading: t('Errors'),
      options: ['issues', 'num_errors', 'users_experiencing_errors'],
    },
  ];
  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');
  if (!isSelfHostedErrorsOnly) {
    if (org.features.includes('crash-rate-alerts')) {
      result.push({
        categoryHeading: t('Sessions'),
        options: ['crash_free_sessions', 'crash_free_users'] satisfies AlertType[],
      });
    }
    result.push({
      categoryHeading: t('Performance'),
      options: [
        'throughput',
        'trans_duration',
        'apdex',
        'failure_rate',
        'lcp',
        'fid',
        'cls',
        ...(hasCustomMetrics(org) ? (['custom_transactions'] satisfies AlertType[]) : []),
        ...(hasEAPAlerts(org) ? ['eap_metrics' as const] : []),
      ],
    });
    if (org.features.includes('insights-addon-modules')) {
      result.push({
        categoryHeading: LLM_MONITORING_MODULE_TITLE,
        options: ['llm_tokens', 'llm_cost'],
      });
    }

    result.push({
      categoryHeading: t('Uptime Monitoring'),
      options: ['uptime_monitor'],
    });
    result.push({
      categoryHeading: hasCustomMetrics(org) ? t('Metrics') : t('Custom'),
      options: [hasCustomMetrics(org) ? 'custom_metrics' : 'custom_transactions'],
    });
  }
  return result;
};

export type WizardRuleTemplate = {
  aggregate: string;
  dataset: Dataset;
  eventTypes: EventTypes;
  query?: string;
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
  custom_transactions: {
    aggregate: 'p95(measurements.fp)',
    dataset: Dataset.GENERIC_METRICS,
    eventTypes: EventTypes.TRANSACTION,
  },
  custom_metrics: {
    aggregate: DEFAULT_METRIC_ALERT_FIELD,
    dataset: Dataset.GENERIC_METRICS,
    eventTypes: EventTypes.TRANSACTION,
  },
  llm_tokens: {
    aggregate: 'sum(ai.total_tokens.used)',
    dataset: Dataset.GENERIC_METRICS,
    eventTypes: EventTypes.TRANSACTION,
  },
  llm_cost: {
    aggregate: 'sum(ai.total_cost)',
    dataset: Dataset.GENERIC_METRICS,
    eventTypes: EventTypes.TRANSACTION,
  },
  crash_free_sessions: {
    aggregate: SessionsAggregate.CRASH_FREE_SESSIONS,
    dataset: Dataset.METRICS,
    eventTypes: EventTypes.SESSION,
  },
  crash_free_users: {
    aggregate: SessionsAggregate.CRASH_FREE_USERS,
    dataset: Dataset.METRICS,
    eventTypes: EventTypes.USER,
  },
  eap_metrics: {
    aggregate: DEFAULT_EAP_METRICS_ALERT_FIELD,
    dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
    eventTypes: EventTypes.TRANSACTION,
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

const ERROR_SUPPORTED_TAGS = [
  FieldKey.IS,
  ...Object.keys(STATIC_FIELD_TAGS_WITHOUT_TRANSACTION_FIELDS).map(
    key => key as FieldKey
  ),
];

// Some data sets support a very limited number of tags. For these cases,
// define all supported tags explicitly
export function datasetSupportedTags(
  dataset: Dataset,
  org: Organization
): TagCollection | undefined {
  return mapValues(
    {
      [Dataset.ERRORS]: ERROR_SUPPORTED_TAGS,
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

export function getSupportedAndOmittedTags(
  dataset: Dataset,
  organization: Organization
): {
  omitTags?: string[];
  supportedTags?: TagCollection;
} {
  const omitTags = datasetOmittedTags(dataset, organization);
  const supportedTags = datasetSupportedTags(dataset, organization);

  const result = {omitTags, supportedTags};

  // remove undefined values, since passing explicit undefined to the SeachBar overrides its defaults
  return Object.keys({omitTags, supportedTags}).reduce<{
    omitTags?: string[];
    supportedTags?: TagCollection;
  }>((acc, key) => {
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
    return MEPAlertsDataset.METRICS_ENHANCED;
  }

  return MEPAlertsDataset.DISCOVER;
}
