import {IncidentTrigger} from './incidentTrigger';

export function IncidentRule(params) {
  return {
    status: 0,
    dateAdded: '2019-07-31T23:02:02.731Z',
    alertThreshold: 24,
    dataset: 'events',
    thresholdType: 0,
    query: '',
    id: '4',
    thresholdPeriod: 1,
    name: 'My Incident Rule',
    timeWindow: 60,
    aggregations: [0],
    resolveThreshold: 13,
    projects: ['project-slug'],
    resolution: 1,
    dateModified: '2019-07-31T23:02:02.731Z',
    triggers: [IncidentTrigger()],
    ...params,
  };
}
