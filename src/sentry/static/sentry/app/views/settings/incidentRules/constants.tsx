import {
  AlertRuleAggregations,
  AlertRuleThresholdType,
  UnsavedIncidentRule,
  Trigger,
} from 'app/views/settings/incidentRules/types';

export function createDefaultTrigger(): Trigger {
  return {
    label: 'critical',
    alertThreshold: 0,
    resolveThreshold: '',
    thresholdType: AlertRuleThresholdType.ABOVE,
    actions: [],
  };
}

export const DEFAULT_METRIC = AlertRuleAggregations.TOTAL;

export function createDefaultRule(): UnsavedIncidentRule {
  return {
    aggregation: DEFAULT_METRIC,
    aggregations: [DEFAULT_METRIC],
    query: '',
    timeWindow: 60,
    triggers: [createDefaultTrigger()],
    projects: [],
  };
}
