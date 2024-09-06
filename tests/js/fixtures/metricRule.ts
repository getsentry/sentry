import {IncidentTriggerFixture} from 'sentry-fixture/incidentTrigger';

import type {SavedMetricRule as SavedMetricRule} from 'sentry/views/alerts/rules/metric/types';
import {AlertRuleComparisonType, Dataset} from 'sentry/views/alerts/rules/metric/types';

export function MetricRuleFixture(
  params: Partial<SavedMetricRule> = {}
): SavedMetricRule {
  return {
    activations: [],
    status: 0,
    dateCreated: '2019-07-31T23:02:02.731Z',
    dataset: Dataset.ERRORS,
    query: '',
    id: '4',
    snooze: false,
    name: 'My Incident Rule',
    timeWindow: 60,
    aggregate: 'count()',
    projects: ['project-slug'],
    dateModified: '2019-07-31T23:02:02.731Z',
    triggers: [IncidentTriggerFixture()],
    resolveThreshold: 36,
    thresholdType: 0,
    thresholdPeriod: 1,
    environment: null,
    detectionType: AlertRuleComparisonType.COUNT,
    ...params,
  };
}
