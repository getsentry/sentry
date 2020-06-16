import {
  AlertRuleThresholdType,
  UnsavedIncidentRule,
  Trigger,
  Dataset,
} from 'app/views/settings/incidentRules/types';
import EventView from 'app/utils/discover/eventView';

export const DEFAULT_AGGREGATE = 'count()';

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
    aggregate:
      eventView.yAxis === 'count_unique(user)'
        ? 'count_unique(tags[sentry:user])'
        : DEFAULT_AGGREGATE,
    environment: eventView.environment.length ? eventView.environment[0] : null,
  };
}
