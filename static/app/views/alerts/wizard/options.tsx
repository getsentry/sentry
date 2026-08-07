import {t} from 'sentry/locale';
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
  | 'crash_free_sessions'
  | 'crash_free_users'
  | 'custom_transactions'
  | 'uptime_monitor'
  | 'crons_monitor'
  | 'eap_metrics'
  | 'trace_item_throughput'
  | 'trace_item_duration'
  | 'trace_item_failure_rate'
  | 'trace_item_lcp'
  | 'trace_item_logs'
  | 'trace_item_metrics';

export enum MEPAlertsQueryType {
  ERROR = 0,
  PERFORMANCE = 1,
  CRASH_RATE = 2,
}

export type MetricAlertType = Exclude<
  AlertType,
  'issues' | 'uptime_monitor' | 'crons_monitor'
>;

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
  custom_transactions: t('Custom Measurement'),
  crash_free_sessions: t('Crash Free Session Rate'),
  crash_free_users: t('Crash Free User Rate'),
  uptime_monitor: t('Uptime Monitor'),
  trace_item_throughput: t('Throughput'),
  trace_item_duration: t('Duration'),
  trace_item_failure_rate: t('Failure Rate'),
  trace_item_lcp: t('Largest Contentful Paint'),
  eap_metrics: t('Spans'),
  trace_item_logs: t('Logs'),
  trace_item_metrics: t('Custom Metrics'),
  crons_monitor: t('Cron Monitor'),
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
    aggregate: 'apdex()',
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
    aggregate: 'count(span.duration)',
    dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
    eventTypes: EventTypes.TRACE_ITEM_SPAN,
  },
  trace_item_throughput: {
    aggregate: 'count(span.duration)',
    dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
    eventTypes: EventTypes.TRACE_ITEM_SPAN,
  },
  trace_item_duration: {
    aggregate: 'p95(span.duration)',
    dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
    eventTypes: EventTypes.TRACE_ITEM_SPAN,
  },
  trace_item_failure_rate: {
    aggregate: 'failure_rate()',
    dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
    eventTypes: EventTypes.TRACE_ITEM_SPAN,
  },
  trace_item_lcp: {
    aggregate: 'p95(measurements.lcp)',
    dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
    eventTypes: EventTypes.TRACE_ITEM_SPAN,
  },
  trace_item_logs: {
    aggregate: 'count(message)',
    dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
    eventTypes: EventTypes.TRACE_ITEM_LOG,
  },
  trace_item_metrics: {
    aggregate: 'sum(value)',
    dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
    eventTypes: EventTypes.TRACE_ITEM_METRIC,
  },
};

export const DEFAULT_WIZARD_TEMPLATE = AlertWizardRuleTemplates.num_errors;
