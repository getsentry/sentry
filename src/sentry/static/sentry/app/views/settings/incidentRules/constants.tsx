import {
  AlertRuleThresholdType,
  UnsavedIncidentRule,
  Trigger,
  Dataset,
} from 'app/views/settings/incidentRules/types';

export const DEFAULT_AGGREGATE = 'count()';

export const PRESET_AGGREGATES = [
  {
    match: /^count\(\)/,
    name: 'Number of errors',
    validDataset: [Dataset.ERRORS],
    default: 'count()',
  },
  {
    match: /^count_unique\(tags\[sentry:user\]\)/,
    name: 'Users affected',
    validDataset: [Dataset.ERRORS],
    default: 'count_unique(tags[sentry:user])',
  },
  {
    match: /^(p[0-9]{2,3}|percentile\(transaction\.duration,[^)]+\))/,
    name: 'Latency',
    validDataset: [Dataset.TRANSACTIONS],
    default: 'percentile(transaction.duration, 0.95)',
  },
  {
    match: /^apdex\([0-9.]+\)/,
    name: 'Apdex',
    validDataset: [Dataset.TRANSACTIONS],
    default: 'apdex(300)',
  },
  {
    match: /^count\(\)/,
    name: 'Throughput',
    validDataset: [Dataset.TRANSACTIONS],
    default: 'count()',
  },
  {
    match: /^error_rate\(\)/,
    name: 'Error rate',
    validDataset: [Dataset.TRANSACTIONS],
    default: 'error_rate()',
  },
];

export const DATASET_EVENT_TYPE_FILTERS = {
  [Dataset.ERRORS]: 'event.type:error',
  [Dataset.TRANSACTIONS]: 'event.type:transaction',
} as const;

export function createDefaultTrigger(): Trigger {
  return {
    label: 'critical',
    alertThreshold: '',
    resolveThreshold: '',
    thresholdType: AlertRuleThresholdType.ABOVE,
    actions: [],
  };
}

export function createDefaultRule(): UnsavedIncidentRule {
  return {
    dataset: Dataset.ERRORS,
    aggregate: DEFAULT_AGGREGATE,
    query: '',
    timeWindow: 1,
    triggers: [createDefaultTrigger()],
    projects: [],
    environment: null,
  };
}
