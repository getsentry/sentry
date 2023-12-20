import {IncidentTrigger} from 'sentry-fixture/incidentTrigger';

import type {MetricRule as TMetricRule} from 'sentry/views/alerts/rules/metric/types';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

export function MetricRule(params: Partial<TMetricRule> = {}): TMetricRule {
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
    thresholdType: 0,
    thresholdPeriod: 1,
    environment: null,
    ...params,
  };
}
