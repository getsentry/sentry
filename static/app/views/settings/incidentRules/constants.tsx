import EventView from 'app/utils/discover/eventView';
import {AggregationKey, LooseFieldKey} from 'app/utils/discover/fields';
import {WEB_VITAL_DETAILS} from 'app/utils/performance/vitals/constants';
import {
  DATA_SOURCE_TO_SET_AND_EVENT_TYPES,
  getQueryDatasource,
} from 'app/views/alerts/utils';
import {WizardRuleTemplate} from 'app/views/alerts/wizard/options';
import {
  AlertRuleThresholdType,
  Dataset,
  Datasource,
  EventTypes,
  Trigger,
  UnsavedIncidentRule,
} from 'app/views/settings/incidentRules/types';

export const DEFAULT_AGGREGATE = 'count()';
export const DEFAULT_TRANSACTION_AGGREGATE = 'p95(transaction.duration)';

export const DATASET_EVENT_TYPE_FILTERS = {
  [Dataset.ERRORS]: 'event.type:error',
  [Dataset.TRANSACTIONS]: 'event.type:transaction',
} as const;

export const DATASOURCE_EVENT_TYPE_FILTERS = {
  [Datasource.ERROR_DEFAULT]: '(event.type:error OR event.type:default)',
  [Datasource.ERROR]: 'event.type:error',
  [Datasource.DEFAULT]: 'event.type:default',
  [Datasource.TRANSACTION]: 'event.type:transaction',
} as const;

type OptionConfig = {
  aggregations: AggregationKey[];
  fields: LooseFieldKey[];
  measurementKeys?: string[];
};

/**
 * Allowed error aggregations for alerts
 */
export const errorFieldConfig: OptionConfig = {
  aggregations: ['count', 'count_unique'],
  fields: ['user'],
};

/**
 * Allowed transaction aggregations for alerts
 */
export const transactionFieldConfig: OptionConfig = {
  aggregations: [
    'avg',
    'percentile',
    'failure_rate',
    'apdex',
    'count',
    'p50',
    'p75',
    'p95',
    'p99',
    'p100',
  ],
  fields: ['transaction.duration'],
  measurementKeys: Object.keys(WEB_VITAL_DETAILS),
};

export function createDefaultTrigger(label: 'critical' | 'warning'): Trigger {
  return {
    label,
    alertThreshold: '',
    actions: [],
  };
}

export function createDefaultRule(): UnsavedIncidentRule {
  return {
    dataset: Dataset.ERRORS,
    eventTypes: [EventTypes.ERROR],
    aggregate: DEFAULT_AGGREGATE,
    query: '',
    timeWindow: 1,
    triggers: [createDefaultTrigger('critical'), createDefaultTrigger('warning')],
    projects: [],
    environment: null,
    resolveThreshold: '',
    thresholdType: AlertRuleThresholdType.ABOVE,
  };
}

/**
 * Create an unsaved alert from a discover EventView object
 */
export function createRuleFromEventView(eventView: EventView): UnsavedIncidentRule {
  const parsedQuery = getQueryDatasource(eventView.query);
  const datasetAndEventtypes = parsedQuery
    ? DATA_SOURCE_TO_SET_AND_EVENT_TYPES[parsedQuery.source]
    : DATA_SOURCE_TO_SET_AND_EVENT_TYPES.error;
  return {
    ...createDefaultRule(),
    ...datasetAndEventtypes,
    query: parsedQuery?.query ?? eventView.query,
    // If creating a metric alert for transactions, default to the p95 metric
    aggregate:
      datasetAndEventtypes.dataset === 'transactions'
        ? 'p95(transaction.duration)'
        : eventView.getYAxis(),
    environment: eventView.environment.length ? eventView.environment[0] : null,
  };
}

export function createRuleFromWizardTemplate(
  wizardTemplate: WizardRuleTemplate
): UnsavedIncidentRule {
  const {eventTypes, ...aggregateDataset} = wizardTemplate;
  return {
    ...createDefaultRule(),
    eventTypes: [eventTypes],
    ...aggregateDataset,
  };
}
