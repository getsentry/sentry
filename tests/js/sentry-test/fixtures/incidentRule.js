import {IncidentTrigger} from './incidentTrigger';

export function IncidentRule(params) {
  return {
    status: 0,
    dateCreated: '2019-07-31T23:02:02.731Z',
    dataset: 'events',
    query: '',
    id: '4',
    name: 'My Incident Rule',
    timeWindow: 60,
    aggregation: 0,
    aggregate: 'count()',
    projects: ['project-slug'],
    dateModified: '2019-07-31T23:02:02.731Z',
    triggers: [IncidentTrigger()],
    resolveThreshold: 36,
    thresholdType: 0,
    ...params,
  };
}
