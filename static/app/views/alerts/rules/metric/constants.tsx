import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {AggregationKeyWithAlias, LooseFieldKey} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  AlertRuleTriggerType,
  Dataset,
  Datasource,
  EventTypes,
  TimeWindow,
  Trigger,
  UnsavedMetricRule,
} from 'sentry/views/alerts/rules/metric/types';
import {
  DATA_SOURCE_TO_SET_AND_EVENT_TYPES,
  getQueryDatasource,
  isSessionAggregate,
} from 'sentry/views/alerts/utils';
import {AlertType, WizardRuleTemplate} from 'sentry/views/alerts/wizard/options';

export const DEFAULT_COUNT_TIME_WINDOW = 1; // 1min
export const DEFAULT_CHANGE_TIME_WINDOW = 60; // 1h
export const DEFAULT_CHANGE_COMP_DELTA = 10080; // 1w

export const DEFAULT_AGGREGATE = 'count()';
export const DEFAULT_TRANSACTION_AGGREGATE = 'p95(transaction.duration)';

export const DATASET_EVENT_TYPE_FILTERS = {
  [Dataset.ERRORS]: 'event.type:error',
  [Dataset.TRANSACTIONS]: 'event.type:transaction',
  [Dataset.GENERIC_METRICS]: 'event.type:transaction',
} as const;

export const DATASOURCE_EVENT_TYPE_FILTERS = {
  [Datasource.ERROR_DEFAULT]: 'event.type:[error, default]',
  [Datasource.ERROR]: 'event.type:error',
  [Datasource.DEFAULT]: 'event.type:default',
  [Datasource.TRANSACTION]: 'event.type:transaction',
} as const;

export type OptionConfig = {
  aggregations: AggregationKeyWithAlias[];
  fields: LooseFieldKey[];
  measurementKeys?: string[];
};

/**
 * Allowed error aggregations for alerts
 */
export const errorFieldConfig: OptionConfig = {
  aggregations: [AggregationKey.Count, AggregationKey.CountUnique],
  fields: ['user'],
};

const commonAggregations = [
  AggregationKey.Avg,
  AggregationKey.Percentile,
  AggregationKey.P50,
  AggregationKey.P75,
  AggregationKey.P95,
  AggregationKey.P99,
  AggregationKey.P100,
];

const allAggregations = [
  ...commonAggregations,
  AggregationKey.FailureRate,
  AggregationKey.Apdex,
  AggregationKey.Count,
];

export const DuplicateMetricFields: string[] = [
  'dataset',
  'eventTypes',
  'aggregate',
  'query',
  'timeWindow',
  'thresholdPeriod',
  'projects',
  'environment',
  'resolveThreshold',
  'thresholdType',
  'owner',
  'name',
  'projectId',
  'comparisonDelta',
];

export const DuplicateTriggerFields: string[] = ['alertThreshold', 'label'];

export const DuplicateActionFields: string[] = [
  'type',
  'targetType',
  'targetIdentifier',
  'inputChannelId',
  'options',
];

export const COMPARISON_DELTA_OPTIONS = [
  {value: 5, label: t('same time 5 minutes ago')}, // 5 minutes
  {value: 15, label: t('same time 15 minutes ago')}, // 15 minutes
  {value: 60, label: t('same time one hour ago')}, // one hour
  {value: 1440, label: t('same time one day ago')}, // one day
  {value: 10080, label: t('same time one week ago')}, // one week
  {value: 43200, label: t('same time one month ago')}, // 30 days
];

export function getWizardAlertFieldConfig(
  alertType: AlertType,
  dataset: Dataset
): OptionConfig {
  if (alertType === 'custom' && dataset === Dataset.ERRORS) {
    return errorFieldConfig;
  }
  // If user selected apdex we must include that in the OptionConfig as it has a user specified column
  const aggregations =
    alertType === 'apdex' || alertType === 'custom'
      ? allAggregations
      : commonAggregations;
  return {
    aggregations,
    fields: ['transaction.duration'],
    measurementKeys: Object.keys(WEB_VITAL_DETAILS),
  };
}

/**
 * Allowed transaction aggregations for alerts
 */
export const transactionFieldConfig: OptionConfig = {
  aggregations: allAggregations,
  fields: ['transaction.duration'],
  measurementKeys: Object.keys(WEB_VITAL_DETAILS),
};

export function createDefaultTrigger(label: AlertRuleTriggerType): Trigger {
  return {
    label,
    alertThreshold: '',
    actions: [],
  };
}

export function createDefaultRule(
  defaultRuleOptions: Partial<UnsavedMetricRule> = {}
): UnsavedMetricRule {
  return {
    dataset: Dataset.ERRORS,
    eventTypes: [EventTypes.ERROR],
    aggregate: DEFAULT_AGGREGATE,
    query: '',
    timeWindow: 60,
    thresholdPeriod: 1,
    triggers: [
      createDefaultTrigger(AlertRuleTriggerType.CRITICAL),
      createDefaultTrigger(AlertRuleTriggerType.WARNING),
    ],
    projects: [],
    environment: null,
    resolveThreshold: '',
    thresholdType: AlertRuleThresholdType.ABOVE,
    ...defaultRuleOptions,
  };
}

/**
 * Create an unsaved alert from a discover EventView object
 */
export function createRuleFromEventView(eventView: EventView): UnsavedMetricRule {
  const parsedQuery = getQueryDatasource(eventView.query);
  const datasetAndEventtypes = parsedQuery
    ? DATA_SOURCE_TO_SET_AND_EVENT_TYPES[parsedQuery.source]
    : DATA_SOURCE_TO_SET_AND_EVENT_TYPES.error;

  let aggregate = eventView.getYAxis();
  if (
    datasetAndEventtypes.dataset === 'transactions' &&
    /^p\d{2,3}\(\)/.test(eventView.getYAxis())
  ) {
    // p95() -> p95(transaction.duration)
    aggregate = eventView.getYAxis().slice(0, 3) + '(transaction.duration)';
  }

  return {
    ...createDefaultRule(),
    ...datasetAndEventtypes,
    query: parsedQuery?.query ?? eventView.query,
    aggregate,
    environment: eventView.environment.length ? eventView.environment[0] : null,
  };
}

export function createRuleFromWizardTemplate(
  wizardTemplate: WizardRuleTemplate
): UnsavedMetricRule {
  const {eventTypes, aggregate, dataset} = wizardTemplate;
  const defaultRuleOptions: Partial<UnsavedMetricRule> = {};

  if (isSessionAggregate(aggregate)) {
    defaultRuleOptions.thresholdType = AlertRuleThresholdType.BELOW;
    defaultRuleOptions.timeWindow = TimeWindow.ONE_HOUR;
  }

  if (aggregate.includes('apdex')) {
    defaultRuleOptions.thresholdType = AlertRuleThresholdType.BELOW;
  }

  return {
    ...createDefaultRule(defaultRuleOptions),
    eventTypes: [eventTypes],
    aggregate,
    dataset,
  };
}

export function getThresholdUnits(
  aggregate: string,
  comparisonType: AlertRuleComparisonType
): string {
  // cls is a number not a measurement of time
  if (
    isSessionAggregate(aggregate) ||
    comparisonType === AlertRuleComparisonType.CHANGE
  ) {
    return '%';
  }

  if (aggregate.includes('measurements.cls')) {
    return '';
  }

  if (aggregate.includes('duration') || aggregate.includes('measurements')) {
    return 'ms';
  }

  return '';
}
