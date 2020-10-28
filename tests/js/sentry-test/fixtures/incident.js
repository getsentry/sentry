import {IncidentRule} from './incidentRule';

export function Incident(params) {
  return {
    id: '321',
    identifier: '123',
    organizationId: '3',
    dateClosed: '2019-04-19T19:44:05.963Z',
    dateStarted: '2019-04-05T19:44:05.963Z',
    dateDetected: '2019-04-05T19:44:05.963Z',
    dateCreated: '2019-04-05T19:44:05.963Z',
    title: 'Too many Chrome errors',
    status: 0,
    projects: [],
    isSubscribed: true,
    alertRule: IncidentRule(),
    ...params,
  };
}
