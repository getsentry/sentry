import {
  AlertRuleThresholdType,
  UnsavedIncidentRule,
  Trigger,
  Dataset,
} from 'app/views/settings/incidentRules/types';
import EventView from 'app/utils/discover/eventView';
import {AggregationKey, LooseFieldKey} from 'app/utils/discover/fields';

export const DEFAULT_AGGREGATE = 'count()';

export const DATASET_EVENT_TYPE_FILTERS = {
  [Dataset.ERRORS]: 'event.type:error',
  [Dataset.TRANSACTIONS]: 'event.type:transaction',
} as const;

type OptionConfig = {
  aggregations: AggregationKey[];
  fields: LooseFieldKey[];
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
  fields: [
    'transaction.duration',
    'measurements.lcp',
    'measurements.fcp',
    'measurements.fp',
    'measurements.fid',
    'measurements.cls',
  ],
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
  return {
    ...createDefaultRule(),
    dataset: eventView.query.includes(DATASET_EVENT_TYPE_FILTERS[Dataset.TRANSACTIONS])
      ? Dataset.TRANSACTIONS
      : Dataset.ERRORS,
    query: eventView.query
      .slice()
      .replace(/event\.type:(transaction|error)/, '')
      .trim(),
    aggregate: eventView.getYAxis(),
    environment: eventView.environment.length ? eventView.environment[0] : null,
  };
}
