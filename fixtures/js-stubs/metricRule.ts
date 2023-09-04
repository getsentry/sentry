import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {CombinedAlertType, CombinedMetricIssueAlerts} from 'sentry/views/alerts/types';

import {IncidentTrigger} from './incidentTrigger';

export function MetricRule<
  T extends CombinedMetricIssueAlerts & {type: CombinedAlertType.METRIC}
>(params: Partial<T> = {}): CombinedMetricIssueAlerts {
  return {
    type: CombinedAlertType.METRIC,
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
