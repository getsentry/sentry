import {Dataset, SavedMetricRule} from 'sentry/views/alerts/rules/metric/types';

import {IncidentTrigger} from './incidentTrigger';

export function MetricRule(params: Partial<SavedMetricRule> = {}): SavedMetricRule {
  return {
    status: 0,
    dateCreated: '2019-07-31T23:02:02.731Z',
    dataset: Dataset.ERRORS,
    query: '',
    id: '4',
    name: 'My Incident Rule',
    timeWindow: 60,
    aggregate: 'count()',
    projects: ['project-slug'],
    dateModified: '2019-07-31T23:02:02.731Z',
    triggers: [IncidentTrigger()],
    resolveThreshold: 36,
    snooze: false,
    thresholdType: 0,
    environment: '',
    thresholdPeriod: 3,
    ...params,
  };
}
