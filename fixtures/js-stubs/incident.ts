import {MetricRule} from 'sentry-fixture/metricRule';

import type {Incident as TIncident} from 'sentry/views/alerts/types';
import {IncidentStatus, IncidentStatusMethod} from 'sentry/views/alerts/types';

export function Incident(params: Partial<TIncident> = {}): TIncident {
  return {
    id: '321',
    identifier: '123',
    organizationId: '3',
    dateClosed: '2016-04-19T19:44:05.963Z',
    dateStarted: '2016-04-05T19:44:05.963Z',
    dateDetected: '2016-04-05T19:44:05.963Z',
    dateCreated: '2016-04-05T19:44:05.963Z',
    title: 'Too many Chrome errors',
    status: IncidentStatus.CLOSED,
    projects: [],
    isSubscribed: true,
    alertRule: MetricRule(params.alertRule),
    activities: [
      {
        id: '78',
        incidentIdentifier: '50729',
        user: null,
        type: 2,
        value: '2',
        previousValue: '20',
        comment: null,
        dateCreated: '2022-03-27T00:38:00Z',
      },
      {
        id: '33',
        incidentIdentifier: '50729',
        user: null,
        type: 2,
        value: '20',
        previousValue: '1',
        comment: null,
        dateCreated: '2022-03-26T13:03:00Z',
      },
      {
        id: '32',
        incidentIdentifier: '50729',
        user: null,
        type: 1,
        value: null,
        previousValue: null,
        comment: null,
        dateCreated: '2022-03-26T13:02:00Z',
      },
      {
        id: '31',
        incidentIdentifier: '50729',
        user: null,
        type: 4,
        value: null,
        previousValue: null,
        comment: null,
        dateCreated: '2022-03-26T12:00:00Z',
      },
    ],
    discoverQuery: '',
    groups: [],
    hasSeen: false,
    seenBy: [],
    statusMethod: IncidentStatusMethod.MANUAL,
    ...params,
  };
}
