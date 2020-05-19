import {
  AlertRuleThresholdType,
  UnsavedIncidentRule,
  Trigger,
  Dataset,
} from 'app/views/settings/incidentRules/types';

export function createDefaultTrigger(): Trigger {
  return {
    label: 'critical',
    alertThreshold: '',
    resolveThreshold: '',
    thresholdType: AlertRuleThresholdType.ABOVE,
    actions: [],
  };
}

export const DEFAULT_AGGREGATE = 'count()';

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
